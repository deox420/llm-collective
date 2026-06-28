"""router.py — endpoints de conversaciones (comunes) y del Council (SSE).

Council respeta la concurrencia global (un modo a la vez, ADR-0008): adquiere el
lock 'council' antes de orquestar y lo libera siempre al terminar.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from shared import conversations
from shared.concurrency import ModeBusyError, manager
from shared.sse import StageEmitter

from .orchestrator import COUNCIL_STAGES, run_council

router = APIRouter(prefix="/api")

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

# Límite de entrada (07-security: validación de entradas / DoS). Generoso para una
# pregunta real (~4k tokens) pero acota payloads abusivos antes de gastar modelo.
MAX_CONTENT_CHARS = 16_000


def _error(code: str, message: str, status: int, **extra) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, **extra}})


# ── Conversaciones (comunes a los tres proyectos) ────────────────────────
class CreateConversationIn(BaseModel):
    project: str


@router.post("/conversations", status_code=201)
async def create_conversation(payload: CreateConversationIn):
    try:
        return conversations.create(payload.project)
    except ValueError as e:
        return _error("invalid_project", str(e), 400)


@router.get("/conversations")
async def list_conversations(project: str | None = None):
    return {"conversations": conversations.list_conversations(project)}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    conv = conversations.get(conversation_id)
    if conv is None:
        return _error("not_found", "conversación no encontrada", 404)
    return conv


# ── Council ──────────────────────────────────────────────────────────────
class CouncilQueryIn(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)


@router.post("/council/{conversation_id}/query")
async def council_query(conversation_id: str, payload: CouncilQueryIn):
    conv = conversations.get(conversation_id)
    if conv is None:
        return _error("not_found", "conversación no encontrada", 404)
    if conv["project"] != "council":
        return _error("wrong_project", "la conversación no es de council", 400)

    try:
        await manager.acquire("council")
    except ModeBusyError as e:
        return _error("mode_busy", str(e), 409, active_mode=e.active_mode)

    question = payload.content
    conversations.append_message(conversation_id, "user", question)
    emitter = StageEmitter(stages=COUNCIL_STAGES)

    async def produce() -> None:
        try:
            result = await run_council(question, emitter)
            conversations.append_message(
                conversation_id,
                "assistant",
                result["final"],
                stage_data={
                    "opinions": result["opinions"],
                    "reviews": result["reviews"],
                    "anon_map": result["anon_map"],
                    "most_voted": result["most_voted"],
                    "chairman_model": result["chairman_model"],
                },
            )
            await emitter.session_done({"conversation_id": conversation_id})
        except Exception as e:  # noqa: BLE001 - el error se reporta por SSE, no se traga
            await emitter.emit("model_error", {"code": "model_unavailable", "message": str(e)})
            await emitter.close()
        finally:
            await manager.release("council")

    asyncio.create_task(produce())
    return StreamingResponse(emitter.stream(), media_type="text/event-stream", headers=_SSE_HEADERS)
