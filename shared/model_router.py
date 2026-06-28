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
import hashlib
import json
import os
import httpx

from shared import model_config

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

# --- Caché de respuestas (FR-5) -------------------------------------------
# Respuestas idénticas (mismo model_id + mismos messages + mismas opciones) se
# sirven de memoria, sin repetir la llamada al proveedor: ahorra coste y latencia
# (08-costs §"Palancas de ahorro"; cache_hit en 09-operations). Es un caché de
# proceso, en memoria, que se vacía al reiniciar. Desactivable con MODEL_CACHE=0.
CACHE_ENABLED = os.environ.get("MODEL_CACHE", "1").lower() not in ("0", "false", "no", "")
_cache: dict[str, str] = {}
_cache_stats = {"hits": 0, "misses": 0}


def _cache_key(model_id: str, messages: list[dict], opts: dict) -> str:
    blob = json.dumps(
        {"model": model_id, "messages": messages, "opts": opts},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def clear_cache() -> None:
    """Vacía el caché de respuestas y sus contadores (tests / nueva sesión)."""
    _cache.clear()
    _cache_stats.update(hits=0, misses=0)


def cache_stats() -> dict[str, int]:
    """Aciertos/fallos del caché (observabilidad, 09-operations §cache_hit)."""
    return dict(_cache_stats)


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


async def _dispatch(dest: str, model: str, messages: list[dict], **opts) -> str:
    """Enruta al backend según el destino ya resuelto. Propaga errores del proveedor."""
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


def _is_retryable(exc: Exception) -> bool:
    """¿El fallo justifica reintentar con el modelo de respaldo? (NFR-6).

    Sí: error de conexión (proveedor caído), 5xx (p. ej. 502 model_unavailable) y
    404 (el modelo no existe). No: 429 (queue_full → backoff, no cambiar de modelo)
    ni otros 4xx (petición mal formada: otro modelo no la arregla).
    """
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code >= 500 or code == 404
    return isinstance(exc, httpx.RequestError)


async def call_model(
    model_id: str,
    messages: list[dict],
    *,
    use_cache: bool = True,
    _tried: set[str] | None = None,
    **opts,
) -> str:
    """Enruta una llamada al backend correcto según el prefijo del model_id.

    Contrato (02-architecture §2.2): devuelve texto; ValueError si el prefijo es
    desconocido; RuntimeError si falta config (p. ej. GPU_HOST).

    - FR-5: respuestas idénticas (model + messages + opts) se sirven del caché.
      `use_cache=False` fuerza una llamada fresca (p. ej. para no cachear una demo).
    - NFR-6: si el proveedor falla o el modelo no existe, reintenta una vez con el
      modelo de respaldo configurado en model_config (sin ciclos: `_tried`).
    """
    dest = destination_for(model_id)  # ValueError ANTES de red/caché si prefijo malo
    model = model_id.split("/", 1)[1]

    key = _cache_key(model_id, messages, opts) if (use_cache and CACHE_ENABLED) else None
    if key is not None and key in _cache:
        _cache_stats["hits"] += 1
        return _cache[key]

    tried = _tried if _tried is not None else {model_id}
    try:
        result = await _dispatch(dest, model, messages, **opts)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        fb = model_config.fallback_for(model_id)
        if fb and fb not in tried and _is_retryable(exc):
            tried.add(fb)
            return await call_model(fb, messages, use_cache=use_cache, _tried=tried, **opts)
        raise

    if key is not None:
        _cache[key] = result
        _cache_stats["misses"] += 1
    return result


def _host_for(dest: str) -> tuple[str, str | None]:
    """Devuelve (host, api_key) para un destino Ollama. Lanza si falta config."""
    if dest == "cloud":
        return OLLAMA_CLOUD_HOST, OLLAMA_CLOUD_API_KEY
    if dest == "gpu":
        if not GPU_HOST:
            raise RuntimeError("GPU_HOST no configurado en .env")
        return GPU_HOST, None
    if dest == "local":
        return LOCAL_HOST, None
    raise ValueError(f"embeddings no soportados para destino {dest!r}")


async def embed_text(model_id: str, text: str) -> list[float]:
    """Embedding de un texto vía /api/embeddings de Ollama (Second Brain, FR-S1).

    No aplica a anthropic/. El prefijo decide host igual que call_model.
    """
    dest = destination_for(model_id)
    host, api_key = _host_for(dest)
    model = model_id.split("/", 1)[1]
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    r = await _client.post(
        f"{host}/api/embeddings", json={"model": model, "prompt": text}, headers=headers
    )
    r.raise_for_status()
    return r.json()["embedding"]


async def embed_texts(model_id: str, texts: list[str]) -> list[list[float]]:
    """Embeddings de varios textos (secuencial; el batching real lo decide el caller)."""
    return [await embed_text(model_id, t) for t in texts]
