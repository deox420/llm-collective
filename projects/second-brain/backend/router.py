"""router.py — endpoints del Second Brain: indexado + consulta RAG (SSE).

Acceso remoto SOLO por túnel (FR-S5, CON-3, ADR-0006): las rutas dependen de
`require_tunnel`, que solo admite peticiones de loopback o con token de túnel.
La consulta corre bajo el lock global de concurrencia (modo 'brain').
"""
from __future__ import annotations

import asyncio
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

MAX_QUERY_CHARS = 20_000  # tope de entrada de usuario (07-security)

from shared import conversations, model_config
from shared.concurrency import ModeBusyError, manager
from shared.sse import StageEmitter

from .indexer import apply_plan, build_plan
from .retriever import answer_query
from .store import VectorStore

router = APIRouter(prefix="/api")
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

# --- túnel (FR-S5) ---------------------------------------------------------
TUNNEL_TOKEN = os.environ.get("SECONDBRAIN_TUNNEL_TOKEN", "")
_LOOPBACK = {"127.0.0.1", "::1", "localhost", None}


def tunnel_allowed(client_host: str | None, header_token: str | None) -> bool:
    """True si la petición es local o llega autenticada por el túnel."""
    if client_host in _LOOPBACK:
        return True
    if TUNNEL_TOKEN and header_token == TUNNEL_TOKEN:
        return True
    return False


def require_tunnel(request: Request) -> None:
    host = request.client.host if request.client else None
    if not tunnel_allowed(host, request.headers.get("x-tunnel-token")):
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "tunnel_required", "message": "acceso solo por túnel seguro"}},
        )


# --- store singleton -------------------------------------------------------
_store: VectorStore | None = None


def get_store() -> VectorStore:
    global _store
    if _store is None:
        path = os.path.join(os.environ.get("LLMC_DATA_DIR", "data"), "vector")
        _store = VectorStore(path=path)
    return _store


# --- indexado --------------------------------------------------------------
_jobs: dict[str, dict] = {}


class IndexIn(BaseModel):
    vault_path: str
    full: bool = False


@router.post("/secondbrain/index", status_code=202, dependencies=[Depends(require_tunnel)])
async def index(payload: IndexIn):
    store = get_store()
    try:
        plan = build_plan(payload.vault_path, store, full=payload.full)
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": {"code": "vault_not_found", "message": "ruta de vault inexistente"}})

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "chunks_done": 0, "chunks_total": plan["chunks_total"]}

    async def run() -> None:
        def progress(done, total):
            _jobs[job_id].update(chunks_done=done, chunks_total=total)
        try:
            await apply_plan(plan, store, model_config.EMBEDDINGS_MODEL, progress=progress)
            _jobs[job_id]["status"] = "done"
        except Exception as e:  # noqa: BLE001
            _jobs[job_id].update(status="error", error=str(e))

    asyncio.create_task(run())
    return {"job_id": job_id, "chunks_queued": plan["chunks_total"]}


@router.get("/secondbrain/index/{job_id}", dependencies=[Depends(require_tunnel)])
async def index_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": "job desconocido"}})
    return job


# --- consulta --------------------------------------------------------------
class QueryIn(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_QUERY_CHARS)
    top_k: int = Field(default=6, ge=1, le=50)
    council_overlay: bool = False


@router.post("/secondbrain/{conversation_id}/query", dependencies=[Depends(require_tunnel)])
async def query(conversation_id: str, payload: QueryIn):
    conv = conversations.get(conversation_id)
    if conv is None:
        return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": "conversación no encontrada"}})
    if conv["project"] != "second-brain":
        return JSONResponse(status_code=400, content={"error": {"code": "wrong_project", "message": "la conversación no es de second-brain"}})

    try:
        await manager.acquire("brain")
    except ModeBusyError as e:
        return JSONResponse(status_code=409, content={"error": {"code": "mode_busy", "message": str(e), "active_mode": e.active_mode}})

    question = payload.content
    conversations.append_message(conversation_id, "user", question)
    emitter = StageEmitter(stages=["retrieval", "synthesis"])

    async def produce() -> None:
        try:
            result = await answer_query(
                question, get_store(), emitter,
                embed_model=model_config.EMBEDDINGS_MODEL,
                chairman_model=model_config.CHAIRMAN_MODEL,
                top_k=payload.top_k,
            )
            conversations.append_message(
                conversation_id, "assistant", result["answer"],
                stage_data={
                    "retrieved": [{"note_path": n["note_path"], "heading": n["heading"], "score": n["score"]} for n in result["notes"]],
                    "citations": result["citations"],
                },
            )
            await emitter.session_done({"conversation_id": conversation_id})
        except Exception as e:  # noqa: BLE001
            await emitter.emit("model_error", {"code": "model_unavailable", "message": str(e)})
            await emitter.close()
        finally:
            await manager.release("brain")

    asyncio.create_task(produce())
    return StreamingResponse(emitter.stream(), media_type="text/event-stream", headers=_SSE_HEADERS)
