"""orchestrator.py — Council: ensemble democrático + peer review (FR-C1..C4).

Tres etapas (04-council.md):
  1. opinions   — N agentes responden en paralelo (asyncio.gather).      FR-C1
  2. review     — cada agente rankea a los OTROS, anonimizados A/B/C.    FR-C2
  3. synthesis  — el chairman recibe opiniones + rankings y sintetiza.   FR-C3

Todo modelo se invoca por call_model (regla no negociable). Los nombres de modelo
salen de shared/model_config.py, nunca hardcodeados. Emite eventos por SSE: los
concretos de api-spec (stage1_opinion, stage1_complete, stage2_review, stage3_final)
y, en paralelo, el contrato genérico de etapas (stage:start/done) para la escena.
"""
from __future__ import annotations

import asyncio
import json
import random

from shared import model_config
from shared.model_router import call_model
from shared.sse import StageEmitter

COUNCIL_STAGES = ["opinions", "review", "synthesis"]

_REVIEW_SYSTEM = (
    "Eres un evaluador imparcial. Te muestro respuestas anónimas de otros a una "
    "pregunta. Rankéalas por precisión e insight. Responde SOLO con un array JSON "
    'como [{"candidate": "anon-1", "score": 8}], score de 0 a 10.'
)
_CHAIRMAN_SYSTEM = (
    "Eres el chairman de un consejo de modelos. Sintetiza una respuesta final a "
    "partir de las opiniones y de los rankings cruzados. Señala acuerdos y "
    "discrepancias; recuerda que coincidencia no implica verdad."
)


def anonymize(models: list[str], rng: random.Random | None = None) -> dict[str, str]:
    """Mapa modelo -> anon-N aleatorio por consulta (FR-C2).

    El mapa se guarda para auditoría (stage_data) pero NO se expone a los modelos.
    """
    rng = rng or random.Random()
    labels = [f"anon-{i + 1}" for i in range(len(models))]
    rng.shuffle(labels)
    return {m: labels[i] for i, m in enumerate(models)}


def _parse_rankings(raw: str) -> list[dict]:
    """Extrae el array JSON de rankings de la respuesta del revisor (tolerante)."""
    try:
        start = raw.index("[")
        end = raw.rindex("]") + 1
        data = json.loads(raw[start:end])
        out = []
        for item in data:
            if isinstance(item, dict) and "candidate" in item:
                out.append({"candidate": item["candidate"], "score": item.get("score", 0)})
        return out
    except (ValueError, json.JSONDecodeError):
        return []


def most_voted(reviews: list[dict]) -> str | None:
    """Candidato (etiqueta anon) con mayor suma de scores entre los revisores."""
    scores: dict[str, float] = {}
    for r in reviews:
        for rk in r.get("rankings", []):
            scores[rk["candidate"]] = scores.get(rk["candidate"], 0) + rk.get("score", 0)
    if not scores:
        return None
    return max(scores, key=scores.get)


async def _gather_opinions(question: str, models: list[str], emitter: StageEmitter) -> list[dict]:
    async def one(model: str):
        content = await call_model(model, [{"role": "user", "content": question}])
        await emitter.emit("stage1_opinion", {"model": model, "content": content, "partial": False})
        return {"model": model, "content": content}

    results = await asyncio.gather(*(one(m) for m in models), return_exceptions=True)
    opinions = []
    for model, res in zip(models, results):
        if isinstance(res, Exception):
            # Error parcial: un agente falló; se sigue con el resto (NFR-6).
            await emitter.emit("model_error", {"model": model, "code": "model_unavailable"})
            continue
        opinions.append(res)
    return opinions


async def _cross_review(
    opinions: list[dict], mapping: dict[str, str], emitter: StageEmitter
) -> list[dict]:
    async def review_one(op: dict):
        reviewer_model = op["model"]
        reviewer_anon = mapping[reviewer_model]
        # El revisor ve SOLO a los otros, etiquetados con su anon (sin model ids).
        others = [o for o in opinions if o["model"] != reviewer_model]
        body = "\n\n".join(f"[{mapping[o['model']]}]\n{o['content']}" for o in others)
        raw = await call_model(
            reviewer_model,
            [
                {"role": "system", "content": _REVIEW_SYSTEM},
                {"role": "user", "content": body},
            ],
        )
        rankings = _parse_rankings(raw)
        review = {"reviewer": reviewer_anon, "rankings": rankings}
        await emitter.emit("stage2_review", review)
        return review

    results = await asyncio.gather(*(review_one(o) for o in opinions), return_exceptions=True)
    return [r for r in results if not isinstance(r, Exception)]


async def _synthesize(
    question: str,
    opinions: list[dict],
    reviews: list[dict],
    mapping: dict[str, str],
    chairman_model: str,
    emitter: StageEmitter,
) -> str:
    # El chairman recibe TODAS las opiniones + los rankings (FR-C3).
    op_block = "\n\n".join(f"[{mapping[o['model']]}]\n{o['content']}" for o in opinions)
    rk_block = json.dumps(reviews, ensure_ascii=False)
    user = (
        f"Pregunta original:\n{question}\n\n"
        f"Opiniones (anónimas):\n{op_block}\n\n"
        f"Rankings cruzados:\n{rk_block}\n\n"
        "Redacta la respuesta final sintetizada."
    )
    final = await call_model(
        chairman_model,
        [{"role": "system", "content": _CHAIRMAN_SYSTEM}, {"role": "user", "content": user}],
    )
    await emitter.emit("stage3_final", {"content": final, "partial": False})
    return final


async def run_council(
    question: str,
    emitter: StageEmitter,
    *,
    models: list[str] | None = None,
    chairman_model: str | None = None,
) -> dict:
    """Ejecuta las tres etapas, emitiendo eventos, y devuelve el stage_data final."""
    models = models or list(model_config.COUNCIL_MODELS)
    chairman_model = chairman_model or model_config.CHAIRMAN_MODEL

    # Etapa 1 — Opiniones
    await emitter.stage_start("opinions")
    opinions = await _gather_opinions(question, models, emitter)
    await emitter.emit("stage1_complete", {"models": [o["model"] for o in opinions]})
    await emitter.stage_done("opinions")

    # Etapa 2 — Revisión cruzada anonimizada
    await emitter.stage_start("review")
    mapping = anonymize([o["model"] for o in opinions])
    reviews = await _cross_review(opinions, mapping, emitter)
    winner = most_voted(reviews)
    await emitter.stage_done("review", {"most_voted": winner})

    # Etapa 3 — Síntesis del chairman
    await emitter.stage_start("synthesis")
    final = await _synthesize(question, opinions, reviews, mapping, chairman_model, emitter)
    await emitter.stage_done("synthesis")

    return {
        "opinions": opinions,
        "reviews": reviews,
        "anon_map": mapping,
        "most_voted": winner,
        "chairman_model": chairman_model,
        "final": final,
    }
