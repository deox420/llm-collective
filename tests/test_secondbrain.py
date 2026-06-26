"""Tests del Second Brain: chunking, store, indexado incremental, RAG, túnel."""
from __future__ import annotations

import os

import pytest

import secondbrain_backend.indexer as indexer
import secondbrain_backend.retriever as retriever
from secondbrain_backend.chunker import chunk_markdown
from secondbrain_backend.indexer import apply_plan, build_plan
from secondbrain_backend.router import tunnel_allowed
from secondbrain_backend.store import VectorStore
from shared.sse import StageEmitter

_VOCAB = ["sync", "crdt", "local", "cache", "lru", "email", "regex", "queue", "obsidian"]


def _vec(text: str) -> list[float]:
    t = text.lower()
    return [float(t.count(w)) for w in _VOCAB] + [1.0]


async def fake_embed_texts(model, texts):
    return [_vec(t) for t in texts]


async def fake_embed_text(model, text):
    return _vec(text)


class RecordingEmitter(StageEmitter):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.events = []

    async def emit(self, event, data=None):
        self.events.append((event, data or {}))
        await super().emit(event, data)


# ---------------- chunking (FR-S1) ----------------
def test_chunk_markdown_by_headings():
    md = "# Uno\nTexto uno.\n\n## Dos\nTexto dos."
    chunks = chunk_markdown(md, "nota.md")
    assert len(chunks) == 2
    assert chunks[0]["heading"] == "Uno"
    assert chunks[1]["heading"] == "Dos"
    assert all(c["note_path"] == "nota.md" for c in chunks)
    assert chunks[0]["id"] != chunks[1]["id"]


def test_chunk_splits_long_section():
    body = "\n\n".join(f"Parrafo numero {i} con bastante texto relleno." for i in range(60))
    chunks = chunk_markdown(f"# Larga\n{body}", "n.md", max_chars=300, overlap=40)
    assert len(chunks) > 1


# ---------------- store (vector) ----------------
def test_store_upsert_and_query():
    store = VectorStore()
    chunks = chunk_markdown("# Sync\nCRDT local-first sync", "sync.md")
    store.upsert(chunks, [_vec(c["text"]) for c in chunks])
    chunks2 = chunk_markdown("# Email\nValidar email con regex", "email.md")
    store.upsert(chunks2, [_vec(c["text"]) for c in chunks2])
    res = store.query(_vec("sync crdt local"), top_k=1)
    assert res and res[0]["note_path"] == "sync.md"
    assert res[0]["score"] is not None


# ---------------- indexado incremental (FR-S2) ----------------
def _write(p, name, content):
    f = p / name
    f.write_text(content, encoding="utf-8")
    return f


async def test_index_and_incremental(tmp_path):
    _write(tmp_path, "sync.md", "# Sync\nCRDT local-first")
    _write(tmp_path, "cache.md", "# Cache\nLRU cache LLM")
    store = VectorStore()

    plan = build_plan(str(tmp_path), store)
    assert plan["chunks_total"] >= 2
    await apply_plan(plan, store, "emb", embed_fn=fake_embed_texts)
    assert store.count() >= 2

    # segunda pasada sin cambios → nada que reindexar
    plan2 = build_plan(str(tmp_path), store)
    assert plan2["to_index"] == []

    # modificar una nota (mtime distinto) → solo esa se reindexa
    f = _write(tmp_path, "sync.md", "# Sync\nAhora usamos Yjs")
    os.utime(f, (f.stat().st_atime + 50, f.stat().st_mtime + 50))
    plan3 = build_plan(str(tmp_path), store)
    assert [i["note_path"] for i in plan3["to_index"]] == ["sync.md"]

    # nota borrada del disco → se elimina del store
    (tmp_path / "cache.md").unlink()
    plan4 = build_plan(str(tmp_path), store)
    assert "cache.md" in plan4["deleted"]


# ---------------- RAG: cita notas reales (FR-S3, FR-S4) ----------------
async def test_answer_cites_real_notes(monkeypatch):
    store = VectorStore()
    for name, text in [("sync.md", "# Sync\nCRDT local-first sync"), ("email.md", "# Email\nregex email")]:
        ch = chunk_markdown(text, name)
        store.upsert(ch, [_vec(c["text"]) for c in ch])

    async def fake_call(model_id, messages, **opts):
        return "Decidiste CRDT, según (sync.md)."
    monkeypatch.setattr(retriever, "call_model", fake_call)

    em = RecordingEmitter(stages=["retrieval", "synthesis"])
    result = await retriever.answer_query(
        "¿qué decidí sobre sync?", store, em,
        embed_model="emb", chairman_model="chair", top_k=2, embed_fn=fake_embed_text,
    )
    assert result["citations"]
    assert "sync.md" in result["citations"]
    # los eventos SSE salieron en orden
    names = [e for e, _ in em.events]
    assert names.index("retrieved") < names.index("answer") < names.index("citations")


# ---------------- túnel (FR-S5, TC-S5) ----------------
def test_tunnel_guard_rejects_direct():
    # loopback siempre permitido
    assert tunnel_allowed("127.0.0.1", None) is True
    # acceso directo externo sin token → rechazado (puerto directo)
    assert tunnel_allowed("203.0.113.9", None) is False
    assert tunnel_allowed("203.0.113.9", "wrong") is False


def test_tunnel_guard_allows_token(monkeypatch):
    import secondbrain_backend.router as r
    monkeypatch.setattr(r, "TUNNEL_TOKEN", "secret")
    assert r.tunnel_allowed("203.0.113.9", "secret") is True
    assert r.tunnel_allowed("203.0.113.9", "nope") is False
