"""Test end-to-end de los endpoints del Second Brain (index + query SSE)."""
from __future__ import annotations

import asyncio

import httpx
import pytest

import secondbrain_backend.indexer as indexer
import secondbrain_backend.retriever as retriever
import secondbrain_backend.router as sb_router
from secondbrain_backend.store import VectorStore
from shared import conversations
from tests.test_secondbrain import fake_embed_text, fake_embed_texts


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(conversations, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(sb_router, "_store", VectorStore())          # store en memoria
    monkeypatch.setattr(indexer, "embed_texts", fake_embed_texts)    # embeddings mock (sin red)
    monkeypatch.setattr(retriever, "embed_text", fake_embed_text)

    async def fake_call(model_id, messages, **opts):
        return "Según tus notas (sync.md), decidiste CRDT."
    monkeypatch.setattr(retriever, "call_model", fake_call)


@pytest.fixture
async def client():
    from app import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def vault(tmp_path):
    d = tmp_path / "vault"
    d.mkdir()
    (d / "sync.md").write_text("# Sync\nCRDT local-first sync sin servidor", encoding="utf-8")
    (d / "email.md").write_text("# Email\nValidar email con regex", encoding="utf-8")
    return str(d)


async def test_index_then_query(client, vault):
    r = await client.post("/api/secondbrain/index", json={"vault_path": vault})
    assert r.status_code == 202
    job = r.json()
    assert job["chunks_queued"] >= 2

    # esperar a que el job termine (corre en background en el mismo loop)
    for _ in range(50):
        st = (await client.get(f"/api/secondbrain/index/{job['job_id']}")).json()
        if st["status"] == "done":
            break
        await asyncio.sleep(0.05)
    assert st["status"] == "done"
    assert st["chunks_done"] == st["chunks_total"]

    cid = (await client.post("/api/conversations", json={"project": "second-brain"})).json()["id"]
    events = []
    async with client.stream("POST", f"/api/secondbrain/{cid}/query", json={"content": "¿qué decidí sobre sync?", "top_k": 3}) as resp:
        assert resp.status_code == 200
        async for line in resp.aiter_lines():
            if line.startswith("event:"):
                events.append(line[len("event:"):].strip())
    assert "retrieved" in events and "answer" in events and "citations" in events
    assert events[-1] == "session:done"

    conv = (await client.get(f"/api/conversations/{cid}")).json()
    sd = conv["messages"][-1]["stage_data"]
    assert sd["citations"]  # cita notas reales recuperadas (FR-S4)
    assert any(c.endswith(".md") for c in sd["citations"])


async def test_index_vault_not_found(client):
    r = await client.post("/api/secondbrain/index", json={"vault_path": "/no/existe/vault"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "vault_not_found"
