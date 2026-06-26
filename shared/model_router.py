"""
model_router.py — capa común de invocación de modelos para LLM Collective.

Toda llamada a un LLM en los tres proyectos (council, dev-team, second-brain)
pasa por call_model(). El destino se decide por el prefijo del model_id:

    cloud/<modelo>      -> Ollama Cloud
    gpu/<modelo>        -> servidor GPU alquilado corriendo Ollama
    local/<modelo>      -> Ollama local
    anthropic/<modelo>  -> API de Anthropic (de pago)

Esto hace que mover un modelo entre cloud, GPU dedicada y local sea
cambiar un string en la config, no tocar la lógica de cada app.
"""
from __future__ import annotations
import os
import httpx

OLLAMA_CLOUD_HOST = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
OLLAMA_CLOUD_API_KEY = os.environ.get("OLLAMA_CLOUD_API_KEY", "")
GPU_HOST = os.environ.get("GPU_HOST", "")
LOCAL_HOST = os.environ.get("OLLAMA_LOCAL_HOST", "http://localhost:11434")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Prefijos soportados -> nombre de destino. El resto de la lógica (config, tests)
# se apoya en esto para no duplicar la lista de prefijos.
KNOWN_PREFIXES: dict[str, str] = {
    "cloud/": "cloud",
    "gpu/": "gpu",
    "local/": "local",
    "anthropic/": "anthropic",
}

_client = httpx.AsyncClient(timeout=120.0)


def destination_for(model_id: str) -> str:
    """Destino ('cloud'|'gpu'|'local'|'anthropic') de un model_id por su prefijo.

    Lanza ValueError si el prefijo no está soportado (api-spec: unknown_model_prefix).
    """
    for prefix, dest in KNOWN_PREFIXES.items():
        if model_id.startswith(prefix):
            return dest
    raise ValueError(f"Prefijo de modelo desconocido: {model_id!r}")


async def _ollama_chat(host: str, model: str, messages: list[dict],
                       api_key: str | None = None, **opts) -> str:
    """Llama al endpoint /api/chat de un servidor Ollama (cloud, gpu o local)."""
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model, "messages": messages, "stream": False}
    if opts:
        payload["options"] = opts
    r = await _client.post(f"{host}/api/chat", json=payload, headers=headers)
    r.raise_for_status()
    return r.json()["message"]["content"]


async def _anthropic_messages(model: str, messages: list[dict],
                              max_tokens: int = 2000, **opts) -> str:
    """Adapta el payload al formato de la API de Anthropic (system separado)."""
    system = None
    convo = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            convo.append(m)
    body = {"model": model, "max_tokens": max_tokens, "messages": convo}
    if system:
        body["system"] = system
    r = await _client.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=body,
    )
    r.raise_for_status()
    return r.json()["content"][0]["text"]


async def call_model(model_id: str, messages: list[dict], **opts) -> str:
    """Enruta una llamada al backend correcto según el prefijo del model_id.

    Contrato (02-architecture §2.2): devuelve texto; ValueError si el prefijo es
    desconocido; RuntimeError si falta config (p. ej. GPU_HOST); propaga errores
    HTTP del proveedor para que el orquestador aplique fallback (NFR-6).
    """
    dest = destination_for(model_id)  # ValueError si prefijo desconocido
    model = model_id.split("/", 1)[1]
    if dest == "cloud":
        return await _ollama_chat(OLLAMA_CLOUD_HOST, model, messages,
                                  api_key=OLLAMA_CLOUD_API_KEY, **opts)
    if dest == "gpu":
        if not GPU_HOST:
            raise RuntimeError("GPU_HOST no configurado en .env")
        return await _ollama_chat(GPU_HOST, model, messages, **opts)
    if dest == "local":
        return await _ollama_chat(LOCAL_HOST, model, messages, **opts)
    # dest == "anthropic"
    return await _anthropic_messages(model, messages, **opts)
