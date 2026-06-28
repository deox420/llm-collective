"""
model_config.py — qué modelo corre en cada rol, por perfil.

CLAVE DEL DISEÑO: dónde corre cada modelo es solo un prefijo en el string
(cloud/ , gpu/ , local/ , anthropic/). call_model() (model_router.py) lo enruta.
Cambiar de perfil = cambiar ACTIVE_PROFILE. No se toca la lógica de ninguna app.

Esto te permite EMPEZAR A CONSTRUIR con solo tu suscripción de Ollama Cloud y
DECIDIR DESPUÉS si el chairman/architect van a una GPU física (local/) o alquilada
(gpu/). Hasta entonces, todo apunta a cloud/.

Selecciona el perfil con la variable de entorno MODEL_PROFILE (ver .env).
Por defecto: "cloud_only".
"""
from __future__ import annotations
import os

# ---------------------------------------------------------------------------
# PERFILES
# Edita los nombres de modelo a lo que tengas disponible en tu cuenta de Ollama
# Cloud / tu GPU. Los prefijos deciden el destino; el resto es el modelo Ollama.
# ---------------------------------------------------------------------------

PROFILES: dict[str, dict] = {
    # ---- PERFIL POR DEFECTO: todo en Ollama Cloud --------------------------
    # Para empezar a construir y usar el proyecto SIN GPU física ni alquilada.
    # Solo necesitas tu suscripción de Ollama Cloud (Pro = 3 concurrentes).
    "cloud_only": {
        # Nombres del catálogo VIVO de Ollama Cloud (verificado 2026-06-28 contra
        # /api/tags). El council usa 3 familias distintas para diversidad de opinión.
        "council_models": [
            "cloud/deepseek-v3.2",
            "cloud/glm-5",
            "cloud/gpt-oss:120b",
        ],
        "chairman_model": "cloud/deepseek-v4-pro",
        "devteam_roles": {
            "architect":  "cloud/glm-5",
            "programmer": "cloud/qwen3-coder-next",
            "reviewer":   "cloud/deepseek-v3.2",
            "tester":     "cloud/qwen3-coder-next",
        },
        # Embeddings SIEMPRE locales: Ollama Cloud no ofrece embeddings (ADR-0010;
        # /api/embeddings 404, /api/embed 401). El Second Brain requiere Ollama LOCAL
        # (OLLAMA_LOCAL_HOST + `ollama pull nomic-embed-text`). Council y Dev Team no
        # dependen de esto: son 100% cloud.
        "embeddings_model": "local/nomic-embed-text",
        # Fallback configurable (NFR-6): si un modelo cloud falla o no existe,
        # call_model reintenta con el modelo de aquí.
        "fallbacks": {
            "cloud/deepseek-v3.2":     "cloud/glm-5",
            "cloud/glm-5":             "cloud/deepseek-v3.2",
            "cloud/gpt-oss:120b":      "cloud/glm-5",
            "cloud/deepseek-v4-pro":   "cloud/deepseek-v3.2",
            "cloud/qwen3-coder-next":  "cloud/deepseek-v3.2",
        },
    },

    # ---- PERFIL: desarrollo barato en tu equipo ---------------------------
    # Cuando quieras trastear gratis con tu RTX (modelos 7-8B) sin gastar cloud.
    # Requiere Ollama local corriendo (OLLAMA_LOCAL_HOST).
    "local_dev": {
        "council_models": [
            "local/llama3.1:8b",
            "local/qwen2.5:7b",
            "local/mistral:7b",
        ],
        "chairman_model": "local/llama3.1:8b",
        "devteam_roles": {
            "architect":  "local/qwen2.5:7b",
            "programmer": "local/qwen2.5-coder:7b",
            "reviewer":   "local/llama3.1:8b",
            "tester":     "local/qwen2.5-coder:7b",
        },
        "embeddings_model": "local/nomic-embed-text",
        "fallbacks": {
            "local/qwen2.5:7b":       "local/llama3.1:8b",
            "local/mistral:7b":       "local/llama3.1:8b",
            "local/qwen2.5-coder:7b": "local/qwen2.5:7b",
        },
    },

    # ---- PERFIL: producción con chairman en GPU (física o alquilada) ------
    # Cuando DECIDAS físico vs alquiler: el chairman y el architect (los que
    # piden más) van a gpu/. El resto sigue en cloud. Si la GPU es física en
    # tu equipo, cambia el prefijo gpu/ por local/ y apunta OLLAMA_LOCAL_HOST.
    "cloud_plus_gpu": {
        "council_models": [
            "cloud/qwen3:32b",
            "cloud/deepseek-r1:32b",
            "cloud/llama3.3:70b",
        ],
        "chairman_model": "gpu/llama3.3:70b",
        "devteam_roles": {
            "architect":  "gpu/qwen3:72b",
            "programmer": "cloud/qwen3-coder:32b",
            "reviewer":   "cloud/deepseek-r1:32b",
            "tester":     "cloud/qwen3-coder:32b",
        },
        "embeddings_model": "local/nomic-embed-text",
        # Si la GPU alquilada cae o el modelo no está cargado, se cae a cloud para
        # no quedarse sin servicio (NFR-6 + runbook gpu_not_configured).
        "fallbacks": {
            "gpu/llama3.3:70b":      "cloud/llama3.3:70b",
            "gpu/qwen3:72b":         "cloud/qwen3:32b",
            "cloud/qwen3-coder:32b": "cloud/qwen3:32b",
            "cloud/deepseek-r1:32b": "cloud/llama3.3:70b",
        },
    },
}

# ---------------------------------------------------------------------------
# Selección de perfil activo
# ---------------------------------------------------------------------------
ACTIVE_PROFILE = os.environ.get("MODEL_PROFILE", "cloud_only")

if ACTIVE_PROFILE not in PROFILES:
    raise ValueError(
        f"MODEL_PROFILE='{ACTIVE_PROFILE}' no existe. "
        f"Opciones: {', '.join(PROFILES)}"
    )

_cfg = PROFILES[ACTIVE_PROFILE]

COUNCIL_MODELS: list[str] = _cfg["council_models"]
CHAIRMAN_MODEL: str = _cfg["chairman_model"]
DEVTEAM_ROLES: dict[str, str] = _cfg["devteam_roles"]
EMBEDDINGS_MODEL: str = _cfg["embeddings_model"]
# Mapa modelo -> modelo de respaldo del perfil activo (NFR-6). Vacío si el perfil
# no define ninguno: en ese caso no hay fallback y el error se propaga.
FALLBACKS: dict[str, str] = _cfg.get("fallbacks", {})


def fallback_for(model_id: str) -> str | None:
    """Modelo de respaldo configurado para `model_id`, o None si no hay (NFR-6).

    Lo consume call_model (model_router) para reintentar cuando un modelo falla o
    no existe. La política (qué respalda a qué) es config, nunca lógica de app.
    """
    return FALLBACKS.get(model_id)


def describe() -> str:
    """Resumen legible del perfil activo (útil en /health o logs de arranque)."""
    return (
        f"profile={ACTIVE_PROFILE} | council={COUNCIL_MODELS} | "
        f"chairman={CHAIRMAN_MODEL} | embeddings={EMBEDDINGS_MODEL}"
    )
