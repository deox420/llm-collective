"""Tests del orquestador Council con modelos mockeados (FR-C1..C3, TC-C1..C3)."""
from __future__ import annotations

import pytest

from projects.council.backend import orchestrator
from projects.council.backend.orchestrator import (
    _REVIEW_SYSTEM,
    _CHAIRMAN_SYSTEM,
    anonymize,
    most_voted,
    run_council,
    _parse_rankings,
)
from shared.sse import StageEmitter

MODELS = ["cloud/m1", "cloud/m2", "cloud/m3"]
CHAIRMAN = "cloud/chair"
# Contenidos de opinión SIN el id de modelo (para poder verificar que no se filtra).
OPINIONS = {"cloud/m1": "Idea Alfa", "cloud/m2": "Idea Beta", "cloud/m3": "Idea Gamma"}


class RecordingEmitter(StageEmitter):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.events = []

    async def emit(self, event, data=None):
        self.events.append((event, data or {}))
        await super().emit(event, data)


def make_fake(calls, fail_model=None):
    async def fake_call_model(model_id, messages, **opts):
        calls.append({"model": model_id, "messages": messages})
        system = messages[0]["content"] if messages and messages[0]["role"] == "system" else None
        is_opinion = system is None
        if is_opinion and model_id == fail_model:
            raise RuntimeError("agente caído")
        if system == _REVIEW_SYSTEM:
            return '[{"candidate": "anon-1", "score": 7}, {"candidate": "anon-2", "score": 5}]'
        if system == _CHAIRMAN_SYSTEM:
            return "SÍNTESIS FINAL DEL CHAIRMAN"
        return OPINIONS.get(model_id, "opinión")

    return fake_call_model


@pytest.fixture
def patch_model(monkeypatch):
    def _apply(calls, fail_model=None):
        monkeypatch.setattr(orchestrator, "call_model", make_fake(calls, fail_model))
    return _apply


def test_parse_rankings_tolerant():
    assert _parse_rankings('blah [{"candidate":"anon-1","score":9}] tail') == [
        {"candidate": "anon-1", "score": 9}
    ]
    assert _parse_rankings("no json") == []


def test_anonymize_is_complete_and_unique():
    m = anonymize(MODELS)
    assert set(m.keys()) == set(MODELS)
    assert sorted(m.values()) == ["anon-1", "anon-2", "anon-3"]


def test_most_voted_sums_scores():
    reviews = [
        {"reviewer": "anon-1", "rankings": [{"candidate": "anon-2", "score": 7}]},
        {"reviewer": "anon-3", "rankings": [{"candidate": "anon-2", "score": 4}, {"candidate": "anon-1", "score": 9}]},
    ]
    assert most_voted(reviews) == "anon-2"  # 7+4=11 > 9


async def test_quorum_collects_all_three_in_parallel(patch_model):
    calls = []
    patch_model(calls)
    em = RecordingEmitter(stages=["opinions", "review", "synthesis"])
    result = await run_council("¿pregunta?", em, models=MODELS, chairman_model=CHAIRMAN)
    assert len(result["opinions"]) == 3
    assert {o["model"] for o in result["opinions"]} == set(MODELS)
    # stage1_complete lista los 3 modelos.
    complete = [d for e, d in em.events if e == "stage1_complete"][0]
    assert set(complete["models"]) == set(MODELS)


async def test_quorum_proceeds_when_one_agent_fails(patch_model):
    calls = []
    patch_model(calls, fail_model="cloud/m2")
    em = RecordingEmitter(stages=["opinions", "review", "synthesis"])
    result = await run_council("¿pregunta?", em, models=MODELS, chairman_model=CHAIRMAN)
    assert len(result["opinions"]) == 2
    assert "cloud/m2" not in {o["model"] for o in result["opinions"]}
    errors = [d for e, d in em.events if e == "model_error"]
    assert errors and errors[0]["model"] == "cloud/m2"


async def test_review_is_anonymized_no_model_ids_leak(patch_model):
    calls = []
    patch_model(calls)
    em = RecordingEmitter(stages=["opinions", "review", "synthesis"])
    await run_council("¿pregunta?", em, models=MODELS, chairman_model=CHAIRMAN)

    review_calls = [c for c in calls if c["messages"][0]["content"] == _REVIEW_SYSTEM]
    assert len(review_calls) == 3
    for c in review_calls:
        body = c["messages"][1]["content"]
        assert "cloud/" not in body  # no se filtran ids de modelo (FR-C2)
        assert "anon-" in body  # se usan etiquetas anónimas


async def test_chairman_receives_all_opinions_and_rankings(patch_model):
    calls = []
    patch_model(calls)
    em = RecordingEmitter(stages=["opinions", "review", "synthesis"])
    result = await run_council("¿pregunta?", em, models=MODELS, chairman_model=CHAIRMAN)

    chair_calls = [c for c in calls if c["messages"][0]["content"] == _CHAIRMAN_SYSTEM]
    assert len(chair_calls) == 1
    user = chair_calls[0]["messages"][1]["content"]
    for content in OPINIONS.values():
        assert content in user  # todas las opiniones llegan al chairman (FR-C3)
    assert "Rankings" in user
    assert result["final"] == "SÍNTESIS FINAL DEL CHAIRMAN"
    # stage3_final emitido con la síntesis.
    finals = [d for e, d in em.events if e == "stage3_final"]
    assert finals and finals[0]["content"] == "SÍNTESIS FINAL DEL CHAIRMAN"
