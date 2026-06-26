"""store.py — base vectorial del Second Brain sobre Chroma (data-model.md).

Guarda los chunks con sus embeddings y metadatos (note_path, heading, chunk_index)
y un manifiesto note_path→mtime para el reindexado incremental (FR-S2).

- Persistente (`path`): para uso real bajo data/vector/.
- Efímero (sin `path`): en memoria, para tests (no requiere disco ni red).
"""
from __future__ import annotations

import json
import pathlib

import chromadb

_COLLECTION = "vault"


class VectorStore:
    def __init__(self, path: str | None = None) -> None:
        if path:
            p = pathlib.Path(path)
            p.mkdir(parents=True, exist_ok=True)
            self.client = chromadb.PersistentClient(path=str(p))
            self.manifest_path: pathlib.Path | None = p / "manifest.json"
        else:
            self.client = chromadb.EphemeralClient()
            self.manifest_path = None
        self.col = self.client.get_or_create_collection(
            _COLLECTION, metadata={"hnsw:space": "cosine"}
        )
        self._manifest: dict[str, float] = self._load_manifest()

    def _load_manifest(self) -> dict:
        if self.manifest_path and self.manifest_path.exists():
            return json.loads(self.manifest_path.read_text(encoding="utf-8"))
        return {}

    def _save_manifest(self) -> None:
        if self.manifest_path:
            self.manifest_path.write_text(json.dumps(self._manifest), encoding="utf-8")

    # --- manifiesto de mtimes (reindexado incremental) -------------------
    def note_mtime(self, note_path: str) -> float | None:
        return self._manifest.get(note_path)

    def set_note_mtime(self, note_path: str, mtime: float) -> None:
        self._manifest[note_path] = mtime
        self._save_manifest()

    def known_notes(self) -> set[str]:
        return set(self._manifest)

    # --- chunks ----------------------------------------------------------
    def delete_note(self, note_path: str) -> None:
        self.col.delete(where={"note_path": note_path})
        self._manifest.pop(note_path, None)
        self._save_manifest()

    def upsert(self, chunks: list[dict], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        self.col.upsert(
            ids=[c["id"] for c in chunks],
            embeddings=embeddings,
            documents=[c["text"] for c in chunks],
            metadatas=[{
                "note_path": c["note_path"], "heading": c["heading"],
                "chunk_index": c["chunk_index"],
            } for c in chunks],
        )

    def query(self, embedding: list[float], top_k: int) -> list[dict]:
        n = min(top_k, max(1, self.col.count()))
        res = self.col.query(query_embeddings=[embedding], n_results=n)
        ids = res["ids"][0]
        docs = res["documents"][0]
        metas = res["metadatas"][0]
        dists = (res.get("distances") or [[None] * len(ids)])[0]
        out = []
        for i in range(len(ids)):
            d = dists[i]
            score = round(1 - d, 3) if d is not None else None  # distancia coseno → similitud
            out.append({
                "note_path": metas[i]["note_path"], "heading": metas[i].get("heading", ""),
                "snippet": docs[i][:240], "text": docs[i], "score": score,
            })
        return out

    def count(self) -> int:
        return self.col.count()
