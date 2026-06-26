"""Tests del Dev Team: sandbox aislado y pipeline con bucle (FR-D2..D4, TC-D1..D4)."""
from __future__ import annotations

import pytest

import devteam_backend.pipeline as pipeline
from devteam_backend.pipeline import parse_files, run_devteam
from devteam_backend.sandbox import Sandbox, SandboxError
from shared.sse import StageEmitter

MODELS = {"architect": "cloud/a", "programmer": "cloud/p", "reviewer": "cloud/r"}


class RecordingEmitter(StageEmitter):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.events = []

    async def emit(self, event, data=None):
        self.events.append((event, data or {}))
        await super().emit(event, data)


# ---------------- Sandbox (NFR-4, TC-D4) ----------------
def test_sandbox_rejects_path_escape():
    sb = Sandbox()
    try:
        with pytest.raises(SandboxError):
            sb.write_file("../escape.txt", "x")
        with pytest.raises(SandboxError):
            sb.write_file("/etc/passwd", "x")
        with pytest.raises(SandboxError):
            sb.read_file("../../etc/hosts")
    finally:
        sb.cleanup()


def test_sandbox_write_read_within_workdir():
    with Sandbox() as sb:
        sb.write_file("pkg/mod.py", "X = 1\n")
        assert "pkg/mod.py" in sb.list_files()
        assert sb.read_file("pkg/mod.py") == "X = 1\n"


def test_sandbox_runs_pytest_real():
    with Sandbox() as sb:
        sb.write_file("test_ok.py", "def test_ok():\n    assert 1 + 1 == 2\n")
        res = sb.run_pytest()
        assert res["passed"] is True
        sb.write_file("test_bad.py", "def test_bad():\n    assert 1 == 2\n")
        res2 = sb.run_pytest()
        assert res2["passed"] is False


def test_parse_files():
    out = "=== FILE: a.py ===\nprint(1)\n=== FILE: b/c.py ===\nx=2\n"
    files = parse_files(out)
    assert files == {"a.py": "print(1)", "b/c.py": "x=2"}


# ---------------- Pipeline (FR-D2..D4) ----------------
def _solution(op: str) -> str:
    return (
        f"=== FILE: solution.py ===\ndef suma(a, b):\n    return a {op} b\n"
        "=== FILE: test_solution.py ===\nfrom solution import suma\n\n"
        "def test_suma():\n    assert suma(2, 3) == 5\n"
    )


def make_fake(always_fail=False):
    async def fake(model_id, messages, **opts):
        sysmsg = (messages[0]["content"] if messages and messages[0]["role"] == "system" else "").lower()
        user = messages[-1]["content"]
        if "arquitecto" in sysmsg:
            return "Plan: función suma(a, b) + test pytest."
        if "revisor" in sysmsg:
            return "Se ve correcto."
        if "programador" in sysmsg:
            # En el reintento (feedback con 'fallaron') corrige, salvo always_fail.
            fixed = (not always_fail) and ("fallaron" in user)
            return _solution("+" if fixed else "-")
        return ""
    return fake


async def test_loop_back_then_pass(monkeypatch):
    monkeypatch.setattr(pipeline, "call_model", make_fake())
    em = RecordingEmitter()
    with Sandbox() as sb:
        result = await run_devteam("suma(a,b)", em, sb, models=MODELS, max_iterations=4)
    names = [e for e, _ in em.events]
    assert "loop_back" in names                 # FR-D2: el tester falló y volvió al programador
    assert result["tests_passed"] is True       # tras el fix, pasa
    assert result["iterations"] == 2            # 1 fallo + 1 arreglo
    # delivery final coherente
    delivery = [d for e, d in em.events if e == "delivery"][0]
    assert delivery["tests_passed"] is True
    assert "solution.py" in delivery["files"]


async def test_max_iterations_caps_loop(monkeypatch):
    monkeypatch.setattr(pipeline, "call_model", make_fake(always_fail=True))
    em = RecordingEmitter()
    with Sandbox() as sb:
        result = await run_devteam("suma(a,b)", em, sb, models=MODELS, max_iterations=2)
    assert result["tests_passed"] is False
    assert result["iterations"] == 2            # FR-D4: no se pasa del tope
    loopbacks = [d for e, d in em.events if e == "loop_back"]
    assert len(loopbacks) == 1                  # solo entre iter 1 y 2; no tras la última
    # el pipeline recorrió los roles
    assert {e for e, _ in em.events} >= {"role_start", "test_result", "delivery"}


async def test_pipeline_writes_into_sandbox(monkeypatch):
    monkeypatch.setattr(pipeline, "call_model", make_fake())
    em = RecordingEmitter()
    with Sandbox() as sb:
        await run_devteam("suma(a,b)", em, sb, models=MODELS, max_iterations=3)
        # los ficheros generados existen DENTRO del sandbox
        assert "solution.py" in sb.list_files()
        assert "test_solution.py" in sb.list_files()
    tool_calls = [d for e, d in em.events if e == "tool_call"]
    assert any(t["args"]["path"] == "solution.py" for t in tool_calls)
