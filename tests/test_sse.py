"""Tests del emisor SSE de etapas (Fase 1 DoD: eventos en orden de etapa)."""
from __future__ import annotations

import json

import pytest

from shared import sse
from shared.sse import StageEmitter, format_sse


def _parse(blocks: list[str]) -> list[tuple[str, dict]]:
    """Convierte bloques SSE en pares (event, data)."""
    out = []
    for b in blocks:
        lines = b.strip().splitlines()
        event = next(l[len("event:"):].strip() for l in lines if l.startswith("event:"))
        data = next(l[len("data:"):].strip() for l in lines if l.startswith("data:"))
        out.append((event, json.loads(data)))
    return out


def test_format_sse_shape():
    block = format_sse("stage:start", {"stage": "opinions"})
    assert block.startswith("event: stage:start\n")
    assert "data: " in block
    assert block.endswith("\n\n")


async def test_events_emitted_in_stage_order():
    em = StageEmitter(stages=["opinions", "review", "synthesis"])
    for s in ["opinions", "review", "synthesis"]:
        await em.stage_start(s)
        await em.stage_done(s)
    await em.session_done({"conversation_id": "abc"})

    events = _parse([b async for b in em.stream()])
    names = [e for e, _ in events]
    assert names == [
        "stage:start", "stage:done",   # opinions
        "stage:start", "stage:done",   # review
        "stage:start", "stage:done",   # synthesis
        "session:done",
    ]
    # Las etapas aparecen en el orden declarado.
    stages_seen = [d["stage"] for e, d in events if e == "stage:start"]
    assert stages_seen == ["opinions", "review", "synthesis"]
    assert events[-1][1]["conversation_id"] == "abc"


async def test_out_of_order_stage_raises():
    em = StageEmitter(stages=["opinions", "review", "synthesis"])
    await em.stage_start("opinions")
    await em.stage_done("opinions")
    with pytest.raises(ValueError):
        await em.stage_start("synthesis")  # se saltó 'review'


async def test_stage_done_must_match_open_stage():
    em = StageEmitter(stages=["opinions", "review"])
    await em.stage_start("opinions")
    with pytest.raises(ValueError):
        await em.stage_done("review")


async def test_emit_after_close_raises():
    em = StageEmitter()
    await em.session_done()
    with pytest.raises(RuntimeError):
        await em.emit(sse.STAGE_START, {"stage": "x"})


async def test_freeform_emit_without_declared_stages():
    # Sin `stages`, emit() acepta eventos concretos de api-spec sin restricción de orden.
    em = StageEmitter()
    await em.emit("stage1_opinion", {"model": "cloud/qwen3:32b", "partial": True})
    await em.emit("model_error", {"model": "cloud/x", "code": "queue_full"})
    await em.close()
    events = _parse([b async for b in em.stream()])
    assert [e for e, _ in events] == ["stage1_opinion", "model_error"]
