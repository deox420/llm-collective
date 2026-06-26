"""app.py — shell del backend común de LLM Collective (FastAPI).

Es el único proceso de backend: las tres apps (Council, Dev Team, Second Brain)
montan sus routers sobre este shell en fases posteriores. De momento expone:
- /health, /api/health  — salud + destinos configurados (Fase 0).
- /api/status           — modo activo global (concurrencia, Fase 1/2).
- /api/demo/{mode}/run  — emisor SSE de etapas de DEMOSTRACIÓN (Fase 2): ejerce el
                          lock global y el StageEmitter para que el frontend consuma
                          eventos reales antes de existir las verticales (Fase 3+).

Arranque:
    uv run uvicorn app:app --reload        # o: python -m uvicorn app:app --reload
"""
from __future__ import annotations

import asyncio

from dotenv import load_dotenv

# Carga .env ANTES de importar nada que lea variables de entorno (model_config,
# model_router, health). local-first: la config vive en .env, nunca en el repo.
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import JSONResponse, StreamingResponse  # noqa: E402

from shared import model_config  # noqa: E402
from shared.concurrency import MODES, ModeBusyError, manager  # noqa: E402
from shared.health import model_availability  # noqa: E402
from shared.sse import StageEmitter  # noqa: E402

from projects.council.backend.router import router as council_router  # noqa: E402

app = FastAPI(title="LLM Collective", version="0.0.0")

# Council (Fase 3): endpoints de conversaciones + /api/council/{id}/query (SSE).
app.include_router(council_router)

# Secuencias de etapas por modo (las reales de cada vertical; aquí solo para la
# demo del shell). Council/DevTeam/Brain según docs 04/05/06 y api-spec.
DEMO_STAGES: dict[str, list[str]] = {
    "council": ["opinions", "review", "synthesis"],
    "devteam": ["architect", "programmer", "reviewer", "tester"],
    "brain": ["retrieval", "synthesis"],
}
# Duración por etapa en la demo (solo para que el progreso sea visible). No es un
# ETA: el frontend muestra ETAPAS, nunca tiempo restante.
_DEMO_STAGE_SECONDS = 0.8


def _health_payload() -> dict:
    return {
        "status": "ok",
        "profile": model_config.ACTIVE_PROFILE,
        "models": model_availability(),
    }


@app.get("/api/health")
async def health() -> dict:
    """Salud del backend + qué destinos de modelo están configurados.

    Contrato en docs/specs/api-spec.md: 200 con {status, models:{cloud, gpu, ...}}.
    """
    return _health_payload()


# Alias en la raíz: el DoD de Fase 0 pide un /health que responda 200, y es
# cómodo para health checks de túnel/orquestadores.
@app.get("/health")
async def health_root() -> dict:
    return _health_payload()


@app.get("/api/status")
async def status() -> dict:
    """Estado de concurrencia: qué modo está activo (o ninguno)."""
    return {"active_mode": manager.active_mode, "modes": sorted(MODES)}


def _error(code: str, message: str, **extra) -> dict:
    return {"error": {"code": code, "message": message, **extra}}


@app.post("/api/demo/{mode}/run")
async def demo_run(mode: str):
    """Demo del shell: ejerce lock global + StageEmitter emitiendo etapas por SSE.

    - 404 si el modo no existe.
    - 409 (mode_busy) si ya hay otro modo activo: demuestra el bloqueo global.
    - 200 text/event-stream con las etapas del modo si se pudo adquirir.
    """
    if mode not in MODES:
        return JSONResponse(
            status_code=404,
            content=_error("unknown_mode", f"modo desconocido: {mode!r}"),
        )

    try:
        await manager.acquire(mode)
    except ModeBusyError as e:
        # Aviso no bloqueante para la UI: qué modo tiene el carril ocupado.
        return JSONResponse(
            status_code=409,
            content=_error("mode_busy", str(e), active_mode=e.active_mode),
        )

    stages = DEMO_STAGES[mode]
    emitter = StageEmitter(stages=stages)

    async def producer() -> None:
        try:
            for stage in stages:
                await emitter.stage_start(stage)
                await asyncio.sleep(_DEMO_STAGE_SECONDS)
                await emitter.stage_done(stage)
            await emitter.session_done({"mode": mode})
        finally:
            # Liberar el modo SIEMPRE, aunque el cliente se desconecte.
            await manager.release(mode)

    asyncio.create_task(producer())
    return StreamingResponse(
        emitter.stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
