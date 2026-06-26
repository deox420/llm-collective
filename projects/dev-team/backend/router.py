"""router.py — endpoint del Dev Team (SSE) bajo el lock global de concurrencia."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

MAX_TASK_CHARS = 20_000  # tope de entrada de usuario (07-security)

from shared import conversations, model_config
from shared.concurrency import ModeBusyError, manager
from shared.sse import StageEmitter

from .pipeline import DEFAULT_MAX_ITERATIONS, run_devteam
from .sandbox import Sandbox

router = APIRouter(prefix="/api")
_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def _error(code: str, message: str, status: int, **extra) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, **extra}})


class TaskIn(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_TASK_CHARS)
    # Tope del bucle de corrección (FR-D4); acotado para no permitir bucles largos.
    max_iterations: int | None = Field(default=None, ge=1, le=20)


@router.post("/devteam/{conversation_id}/task")
async def devteam_task(conversation_id: str, payload: TaskIn):
    conv = conversations.get(conversation_id)
    if conv is None:
        return _error("not_found", "conversación no encontrada", 404)
    if conv["project"] != "dev-team":
        return _error("wrong_project", "la conversación no es de dev-team", 400)

    try:
        await manager.acquire("devteam")
    except ModeBusyError as e:
        return _error("mode_busy", str(e), 409, active_mode=e.active_mode)

    task = payload.content
    max_it = payload.max_iterations or DEFAULT_MAX_ITERATIONS
    conversations.append_message(conversation_id, "user", task)
    emitter = StageEmitter()  # sin orden estricto: el grafo tiene bucle

    async def produce() -> None:
        sandbox = Sandbox()
        try:
            result = await run_devteam(task, emitter, sandbox, max_iterations=max_it)
            conversations.append_message(
                conversation_id, "assistant",
                result.get("plan") or "(pipeline completado)",
                stage_data={
                    "iterations": result["iterations"],
                    "roles": dict(model_config.DEVTEAM_ROLES),
                    "files": result["files"],
                    "tests_passed": result["tests_passed"],
                },
            )
            await emitter.session_done({"conversation_id": conversation_id})
        except Exception as e:  # noqa: BLE001 - se reporta por SSE
            await emitter.emit("model_error", {"code": "model_unavailable", "message": str(e)})
            await emitter.close()
        finally:
            sandbox.cleanup()
            await manager.release("devteam")

    asyncio.create_task(produce())
    return StreamingResponse(emitter.stream(), media_type="text/event-stream", headers=_SSE_HEADERS)
