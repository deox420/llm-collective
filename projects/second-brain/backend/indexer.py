"""indexer.py — ingesta del vault: chunk → embeddings → store (FR-S1, FR-S2).

`build_plan` calcula qué notas reindexar (por mtime) y cuántos chunks, sin embeber
(rápido, para responder 202 con chunks_queued). `apply_plan` embebe y guarda.
"""
from __future__ import annotations

import os
import pathlib

from shared.model_router import embed_texts

from .chunker import chunk_markdown
from .store import VectorStore


def _scan(vault_path: str) -> dict[str, pathlib.Path]:
    vault = pathlib.Path(vault_path)
    if not vault.exists() or not vault.is_dir():
        raise FileNotFoundError(vault_path)
    return {
        str(p.relative_to(vault)).replace(os.sep, "/"): p
        for p in vault.rglob("*.md")
    }


def build_plan(vault_path: str, store: VectorStore, full: bool = False) -> dict:
    md = _scan(vault_path)
    deleted = [n for n in store.known_notes() if n not in md]
    to_index = []
    total = 0
    for rel, p in sorted(md.items()):
        mtime = p.stat().st_mtime
        if not full and store.note_mtime(rel) == mtime:
            continue  # sin cambios (FR-S2)
        chunks = chunk_markdown(p.read_text(encoding="utf-8"), rel)
        to_index.append({"note_path": rel, "mtime": mtime, "chunks": chunks})
        total += len(chunks)
    return {"to_index": to_index, "deleted": deleted, "chunks_total": total, "notes": len(md)}


async def apply_plan(plan: dict, store: VectorStore, embed_model: str, *,
                     embed_fn=None, progress=None) -> dict:
    ef = embed_fn or embed_texts  # late-bound: permite mockear embed_texts en tests
    for note in plan["deleted"]:
        store.delete_note(note)
    done = 0
    for item in plan["to_index"]:
        store.delete_note(item["note_path"])      # borra chunks viejos (incremental)
        chunks = item["chunks"]
        if chunks:
            embeds = await ef(embed_model, [c["text"] for c in chunks])
            store.upsert(chunks, embeds)
        store.set_note_mtime(item["note_path"], item["mtime"])
        done += len(chunks)
        if progress:
            progress(done, plan["chunks_total"])
    return {"chunks_done": done, "chunks_total": plan["chunks_total"]}
