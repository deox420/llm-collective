"""Tests de endpoints: conversaciones (FR-3, TC-4) y Council SSE end-to-end."""
from __future__ import annotations

import httpx
import pytest

from projects.council.backend import orchestrator
from shared import conversations
from tests.test_council_orchestrator import CHAIRMAN, MODELS, make_fake


@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
    # Conversaciones a un directorio temporal (no toca data/ real).
    monkeypatch.setattr(conversations, "_DATA_ROOT", tmp_path)


@pytest.fixture
def use_default_models(monkeypatch):
    # El orquestador usa COUNCIL_MODELS/CHAIRMAN_MODEL del perfil; los fijamos.
    monkeypatch.setattr(orchestrator.model_config, "COUNCIL_MODELS", MODELS)
    monkeypatch.setattr(orchestrator.model_config, "CHAIRMAN_MODEL", CHAIRMAN)
    monkeypatch.setattr(orchestrator, "call_model", make_fake([]))


@pytest.fixture
async def client():
    from app import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_conversation_create_and_get(client):
    r = await client.post("/api/conversations", json={"project": "council"})
    assert r.status_code == 201
    cid = r.json()["id"]
    assert r.json()["project"] == "council"

    r2 = await client.get(f"/api/conversations/{cid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == cid
    assert r2.json()["messages"] == []


async def test_get_missing_conversation_404(client):
    r = await client.get("/api/conversations/does-not-exist")
    assert r.status_code == 404


async def test_council_query_streams_three_stages_and_persists(client, use_default_models):
    cid = (await client.post("/api/conversations", json={"project": "council"})).json()["id"]

    events: list[str] = []
    async with client.stream("POST", f"/api/council/{cid}/query", json={"content": "¿2+2?"}) as r:
        assert r.status_code == 200
        async for line in r.aiter_lines():
            if line.startswith("event:"):
                events.append(line[len("event:"):].strip())

    # Etapas en orden + eventos concretos de api-spec + cierre.
    assert "stage1_opinion" in events
    assert "stage1_complete" in events
    assert "stage2_review" in events
    assert "stage3_final" in events
    assert events[-1] == "session:done"
    assert events.index("stage:start") < events.index("stage:done")

    # Persistencia: mensaje del usuario + síntesis del chairman con stage_data.
    conv = (await client.get(f"/api/conversations/{cid}")).json()
    roles = [m["role"] for m in conv["messages"]]
    assert roles == ["user", "assistant"]
    sd = conv["messages"][1]["stage_data"]
    assert len(sd["opinions"]) == 3
    assert sd["chairman_model"] == CHAIRMAN
    assert "most_voted" in sd


async def test_council_query_on_missing_conversation_404(client, use_default_models):
    r = await client.post("/api/council/nope/query", json={"content": "hola"})
    assert r.status_code == 404
