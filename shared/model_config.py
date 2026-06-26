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
        "council_models": [
            "cloud/qwen3:32b",
            "cloud/deepseek-r1:32b",
            "cloud/llama3.3:70b",
        ],
        "chairman_model": "cloud/llama3.3:70b",
        "devteam_roles": {
            "architect":  "cloud/qwen3:32b",
            "programmer": "cloud/qwen3-coder:32b",
            "reviewer":   "cloud/deepseek-r1:32b",
            "tester":     "cloud/qwen3-coder:32b",
        },
        # Embeddings del Second Brain. En cloud_only van por cloud; cuando tengas
        # Ollama local, cambia a local/nomic-embed-text (gratis y más privado).
        "embeddings_model": "cloud/nomic-embed-text",
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


def describe() -> str:
    """Resumen legible del perfil activo (útil en /health o logs de arranque)."""
    return (
        f"profile={ACTIVE_PROFILE} | council={COUNCIL_MODELS} | "
        f"chairman={CHAIRMAN_MODEL} | embeddings={EMBEDDINGS_MODEL}"
    )
