"""pipeline.py — Dev Team: grafo LangGraph de roles con bucle de corrección.

Grafo (FR-D2, 05-dev-team.md):

    architect → programmer → reviewer → tester
                    ▲                      │
                    └──── si fallan ───────┘   (hasta MAX_FIX_ITERATIONS)

- architect/programmer/reviewer son LLMs vía `call_model` (modelos de model_config).
- tester NO es un LLM: ejecuta pytest REAL dentro del Sandbox (FR-D3, NFR-4).
- El bucle vuelve al programador si el tester falla, con tope de iteraciones (FR-D4).

Emite eventos SSE de api-spec (role_start, role_output, tool_call, test_result,
loop_back, delivery) + el contrato de etapas (stage:start/done) para la escena.
"""
from __future__ import annotations

import re
from typing import TypedDict

from langgraph.graph import END, StateGraph

from shared import model_config
from shared.model_router import call_model
from shared.sse import StageEmitter

from .sandbox import Sandbox

DEFAULT_MAX_ITERATIONS = 5

_FILE_RE = re.compile(r"^===\s*FILE:\s*(.+?)\s*===\s*$", re.M)

_ARCHITECT_SYS = "Eres el arquitecto de software. Diseña un plan breve y claro para la tarea; enumera los ficheros a crear (incluye un fichero de tests pytest). No escribas el código todavía."
_PROGRAMMER_SYS = (
    "Eres el programador. Implementa el plan en Python. Devuelve CADA fichero EXACTAMENTE en este formato, sin texto extra:\n"
    "=== FILE: ruta/al/fichero.py ===\n<contenido completo>\n"
    "Incluye SIEMPRE un fichero de tests pytest (test_*.py) que valide la solución."
)
_REVIEWER_SYS = "Eres el revisor de código. Señala en pocas frases bugs, edge cases o fallos de estilo del código. Si está bien, dilo."


def parse_files(text: str) -> dict[str, str]:
    """Extrae {ruta: contenido} de la salida del programador (marcadores === FILE: ===)."""
    files: dict[str, str] = {}
    matches = list(_FILE_RE.finditer(text))
    for i, m in enumerate(matches):
        path = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip("\n")
        # quita vallas de código si el modelo las añadió
        content = re.sub(r"^```[a-zA-Z0-9]*\n", "", content)
        content = re.sub(r"\n```$", "", content)
        files[path] = content
    return files


class DevState(TypedDict, total=False):
    task: str
    plan: str
    code_files: dict
    review: str
    test_result: dict
    passed: bool
    iteration: int


def build_graph(emitter: StageEmitter, sandbox: Sandbox, models: dict, max_iterations: int):
    architect_model = models["architect"]
    programmer_model = models["programmer"]
    reviewer_model = models["reviewer"]

    async def architect(state: DevState) -> DevState:
        await emitter.emit("stage:start", {"stage": "architect"})
        await emitter.emit("role_start", {"role": "architect", "model": architect_model})
        plan = await call_model(architect_model, [
            {"role": "system", "content": _ARCHITECT_SYS},
            {"role": "user", "content": state["task"]},
        ])
        await emitter.emit("role_output", {"role": "architect", "content": plan, "partial": False})
        await emitter.emit("stage:done", {"stage": "architect"})
        return {"plan": plan}

    async def programmer(state: DevState) -> DevState:
        it = state.get("iteration", 0) + 1
        await emitter.emit("stage:start", {"stage": "programmer"})
        await emitter.emit("role_start", {"role": "programmer", "model": programmer_model, "iteration": it})
        feedback = ""
        if state.get("review"):
            feedback += f"\n\nRevisión previa:\n{state['review']}"
        if state.get("test_result") and not state.get("passed"):
            tr = state["test_result"]
            feedback += f"\n\nLos tests fallaron ({tr.get('summary')}). Salida:\n{tr.get('stdout','')[:1500]}\nCorrige el código."
        out = await call_model(programmer_model, [
            {"role": "system", "content": _PROGRAMMER_SYS},
            {"role": "user", "content": f"Plan:\n{state.get('plan','')}{feedback}"},
        ])
        files = parse_files(out)
        for path, content in files.items():
            sandbox.write_file(path, content)
            await emitter.emit("tool_call", {"role": "programmer", "tool": "write_file", "args": {"path": path}})
        await emitter.emit("role_output", {"role": "programmer", "content": out, "partial": False})
        await emitter.emit("stage:done", {"stage": "programmer"})
        return {"code_files": files, "iteration": it}

    async def reviewer(state: DevState) -> DevState:
        await emitter.emit("stage:start", {"stage": "reviewer"})
        await emitter.emit("role_start", {"role": "reviewer", "model": reviewer_model})
        code = "\n\n".join(f"# {p}\n{c}" for p, c in (state.get("code_files") or {}).items())
        review = await call_model(reviewer_model, [
            {"role": "system", "content": _REVIEWER_SYS},
            {"role": "user", "content": code},
        ])
        await emitter.emit("role_output", {"role": "reviewer", "content": review, "partial": False})
        await emitter.emit("stage:done", {"stage": "reviewer"})
        return {"review": review}

    async def tester(state: DevState) -> DevState:
        await emitter.emit("stage:start", {"stage": "tester"})
        await emitter.emit("role_start", {"role": "tester", "model": "executor"})
        result = sandbox.run_pytest()
        it = state.get("iteration", 1)
        await emitter.emit("test_result", {"passed": result["passed"], "summary": result["summary"], "iteration": it})
        await emitter.emit("stage:done", {"stage": "tester"})
        passed = result["passed"]
        # Si falla y aún hay margen, avisa del retorno al programador (FR-D2).
        if not passed and it < max_iterations:
            await emitter.emit("loop_back", {"to": "programmer", "iteration": it + 1})
        return {"test_result": result, "passed": passed}

    def route(state: DevState) -> str:
        if state.get("passed") or state.get("iteration", 0) >= max_iterations:
            return END
        return "programmer"

    g = StateGraph(DevState)
    g.add_node("architect", architect)
    g.add_node("programmer", programmer)
    g.add_node("reviewer", reviewer)
    g.add_node("tester", tester)
    g.set_entry_point("architect")
    g.add_edge("architect", "programmer")
    g.add_edge("programmer", "reviewer")
    g.add_edge("reviewer", "tester")
    g.add_conditional_edges("tester", route, {"programmer": "programmer", END: END})
    return g.compile()


async def run_devteam(
    task: str,
    emitter: StageEmitter,
    sandbox: Sandbox,
    *,
    models: dict | None = None,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
) -> dict:
    """Ejecuta el pipeline completo y devuelve el resultado (ficheros, tests_passed)."""
    models = models or dict(model_config.DEVTEAM_ROLES)
    graph = build_graph(emitter, sandbox, models, max_iterations)
    final = await graph.ainvoke({"task": task, "iteration": 0}, config={"recursion_limit": 100})
    tests_passed = bool(final.get("passed"))
    files = sorted((final.get("code_files") or {}).keys())
    await emitter.emit("delivery", {"files": files, "tests_passed": tests_passed})
    return {
        "files": files,
        "code_files": final.get("code_files") or {},
        "tests_passed": tests_passed,
        "iterations": final.get("iteration", 0),
        "review": final.get("review", ""),
        "plan": final.get("plan", ""),
        "test_result": final.get("test_result", {}),
    }
