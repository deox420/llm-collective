"""app.py — shell del backend común de LLM Collective (FastAPI).

Es el único proceso de backend: las tres apps (Council, Dev Team, Second Brain)
montan sus routers sobre este shell en fases posteriores. En Fase 0 solo expone
el endpoint de salud, que es el criterio de "hecho" de la fase.

Arranque:
    uv run uvicorn app:app --reload        # o: python -m uvicorn app:app --reload
"""
from __future__ import annotations

from dotenv import load_dotenv

# Carga .env ANTES de importar nada que lea variables de entorno (model_config,
# model_router, health). local-first: la config vive en .env, nunca en el repo.
load_dotenv()

from fastapi import FastAPI  # noqa: E402

from shared import model_config  # noqa: E402
from shared.health import model_availability  # noqa: E402

app = FastAPI(title="LLM Collective", version="0.0.0")


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
