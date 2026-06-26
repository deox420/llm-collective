"""retriever.py — consulta RAG: recuperación + síntesis con citas (FR-S3, FR-S4).

Emite por SSE: retrieved → answer → citations, además del contrato de etapas
(retrieval → synthesis). El chairman responde basándose SOLO en las notas
recuperadas y las cita por su ruta.
"""
from __future__ import annotations

from shared.model_router import call_model, embed_text

from .store import VectorStore

_SYS = (
    "Responde la pregunta del usuario usando ÚNICAMENTE las notas proporcionadas. "
    "Cita las notas relevantes por su ruta entre paréntesis. Si la respuesta no está "
    "en las notas, dilo claramente en vez de inventar."
)


async def answer_query(question: str, store: VectorStore, emitter, *,
                       embed_model: str, chairman_model: str, top_k: int = 6,
                       embed_fn=None) -> dict:
    ef = embed_fn or embed_text  # late-bound: mockeable en tests
    await emitter.emit("stage:start", {"stage": "retrieval"})
    qvec = await ef(embed_model, question)
    notes = store.query(qvec, top_k)
    await emitter.emit("retrieved", {"notes": [
        {"note_path": n["note_path"], "heading": n["heading"], "snippet": n["snippet"], "score": n["score"]}
        for n in notes
    ]})
    await emitter.emit("stage:done", {"stage": "retrieval"})

    await emitter.emit("stage:start", {"stage": "synthesis"})
    context = "\n\n".join(
        f"[{i + 1}] ({n['note_path']}{(' · ' + n['heading']) if n['heading'] else ''})\n{n['text']}"
        for i, n in enumerate(notes)
    )
    final = await call_model(chairman_model, [
        {"role": "system", "content": _SYS},
        {"role": "user", "content": f"Notas:\n{context}\n\nPregunta: {question}"},
    ])
    await emitter.emit("answer", {"content": final, "partial": False})
    citations = list(dict.fromkeys(n["note_path"] for n in notes))
    await emitter.emit("citations", {"notes": citations})
    await emitter.emit("stage:done", {"stage": "synthesis"})
    return {"answer": final, "notes": notes, "citations": citations}
