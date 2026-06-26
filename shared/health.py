"""health.py — disponibilidad de cada destino de modelo para /api/health.

Refleja qué destinos (cloud, gpu, local, anthropic) están CONFIGURADOS según el
entorno. No hace llamadas de red: comprobar disponibilidad real implicaría pingar
cada proveedor en cada /health, lo cual es caro y ruidoso. "Configurado" = hay
credencial/host suficiente para intentar la llamada.

Importante (privacidad, CLAUDE.md): este módulo NO devuelve claves ni hosts,
solo booleanos. Nada de secretos en la respuesta.
"""
from __future__ import annotations

import os


def model_availability() -> dict[str, bool]:
    """Devuelve un booleano por destino indicando si está configurado.

    - cloud:     requiere OLLAMA_CLOUD_API_KEY (el host tiene default).
    - gpu:       requiere GPU_HOST (sin default; ver ADR-0002/0006).
    - local:     requiere OLLAMA_LOCAL_HOST.
    - anthropic: requiere ANTHROPIC_API_KEY (opcional, de pago).
    """
    return {
        "cloud": bool(os.environ.get("OLLAMA_CLOUD_API_KEY")),
        "gpu": bool(os.environ.get("GPU_HOST")),
        "local": bool(os.environ.get("OLLAMA_LOCAL_HOST")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }
