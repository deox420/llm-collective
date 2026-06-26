"""sse.py — emisor de eventos SSE de etapas, reutilizable por los tres modos.

Contrato genérico de escena/etapas en 13-interactive-scenes.md §13.2; el detalle
por endpoint (nombres concretos como stage1_opinion) está en specs/api-spec.md. Este
módulo da el *transporte* común: una cola async que el orquestador alimenta y que el
endpoint SSE (FastAPI StreamingResponse) consume.

Principios (CLAUDE.md):
- Progreso por ETAPAS, nunca ETA por tiempo: los eventos describen en qué etapa se
  está, no cuánto falta.
- La escena refleja el estado real: cada evento sale de un paso real del pipeline.

Uso típico en un endpoint:
    emitter = StageEmitter(stages=["opinions", "review", "synthesis"])
    async def run():
        async with manager.run("council"):
            await emitter.stage_start("opinions")
            ...
            await emitter.session_done({"conversation_id": cid})
    asyncio.create_task(run())
    return StreamingResponse(emitter.stream(), media_type="text/event-stream")
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

# Eventos genéricos del contrato de etapas (§13.2). Las apps pueden emitir además
# sus eventos concretos (api-spec) con emit().
STAGE_START = "stage:start"
STAGE_DONE = "stage:done"
AGENT_ACTIVE = "agent:active"
AGENT_WAITING = "agent:waiting"
HANDOFF = "handoff"
SESSION_DONE = "session:done"
MODE_LOCKED = "mode:locked"


def format_sse(event: str, data: dict | None = None) -> str:
    """Formatea un evento como un bloque SSE `event:`/`data:` terminado en \\n\\n."""
    payload = json.dumps(data or {}, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


class StageEmitter:
    """Cola async de eventos SSE de etapa.

    Si se construye con `stages`, los `stage_start` deben seguir ese orden (y cada
    `stage_done` cerrar la etapa abierta); emitir fuera de orden lanza ValueError.
    Esto hace cumplir "los eventos SSE se emiten en orden de etapa" (DoD Fase 1).
    """

    # Sentinela interno para señalar fin de stream a los consumidores.
    _CLOSED = object()

    def __init__(self, stages: list[str] | None = None) -> None:
        self.stages = list(stages) if stages else None
        self._queue: asyncio.Queue = asyncio.Queue()
        self._closed = False
        self._stage_idx = 0
        self._open_stage: str | None = None

    # --- emisión genérica -------------------------------------------------
    async def emit(self, event: str, data: dict | None = None) -> None:
        """Encola un evento arbitrario (nombre + payload JSON-serializable)."""
        if self._closed:
            raise RuntimeError("StageEmitter ya cerrado; no se pueden emitir eventos")
        await self._queue.put((event, data or {}))

    # --- ciclo de vida de etapas (contrato §13.2) -------------------------
    async def stage_start(self, stage: str, data: dict | None = None) -> None:
        if self.stages is not None:
            if self._stage_idx >= len(self.stages) or stage != self.stages[self._stage_idx]:
                expected = (
                    self.stages[self._stage_idx]
                    if self._stage_idx < len(self.stages)
                    else "<fin>"
                )
                raise ValueError(
                    f"etapa fuera de orden: se esperaba {expected!r}, llegó {stage!r}"
                )
            self._open_stage = stage
        await self.emit(STAGE_START, {"stage": stage, **(data or {})})

    async def stage_done(self, stage: str, data: dict | None = None) -> None:
        if self.stages is not None:
            if stage != self._open_stage:
                raise ValueError(
                    f"stage_done({stage!r}) no coincide con la etapa abierta {self._open_stage!r}"
                )
            self._open_stage = None
            self._stage_idx += 1
        await self.emit(STAGE_DONE, {"stage": stage, **(data or {})})

    async def agent_active(self, agent_id: str, data: dict | None = None) -> None:
        await self.emit(AGENT_ACTIVE, {"agent": agent_id, **(data or {})})

    async def agent_waiting(self, agent_id: str, data: dict | None = None) -> None:
        await self.emit(AGENT_WAITING, {"agent": agent_id, **(data or {})})

    async def handoff(self, frm: str, to: str, data: dict | None = None) -> None:
        await self.emit(HANDOFF, {"from": frm, "to": to, **(data or {})})

    async def mode_locked(self, data: dict | None = None) -> None:
        await self.emit(MODE_LOCKED, data or {})

    async def session_done(self, data: dict | None = None) -> None:
        """Emite el evento final y cierra el stream."""
        await self.emit(SESSION_DONE, data or {})
        await self.close()

    # --- consumo ----------------------------------------------------------
    async def close(self) -> None:
        if not self._closed:
            self._closed = True
            await self._queue.put(self._CLOSED)

    async def stream(self) -> AsyncIterator[str]:
        """Generador async de strings SSE; termina al recibir el sentinela de cierre."""
        while True:
            item = await self._queue.get()
            if item is self._CLOSED:
                return
            event, data = item
            yield format_sse(event, data)
