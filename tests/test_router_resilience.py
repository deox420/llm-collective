"""Tests de resiliencia del router: caché (FR-5/TC-5) y fallback (NFR-6/TC-6).

Se mockea el transporte httpx para contar cuántas peticiones reales se hacen y a
qué modelo, sin tocar la red.
"""
from __future__ import annotations

import json

import httpx
import pytest

from shared import model_config, model_router


def _mock_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# ── FR-5 / TC-5 · Caché de respuestas ─────────────────────────────────────
async def test_identical_calls_hit_cache_once(monkeypatch):
    """TC-5: dos consultas idénticas hacen UNA sola llamada al modelo."""
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": "cacheable"}})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_router, "CACHE_ENABLED", True)
    model_router.clear_cache()

    messages = [{"role": "user", "content": "misma pregunta"}]
    out1 = await model_router.call_model("cloud/qwen3:32b", messages)
    out2 = await model_router.call_model("cloud/qwen3:32b", messages)

    assert out1 == out2 == "cacheable"
    assert len(calls) == 1, "la segunda llamada idéntica debe servirse del caché"
    assert model_router.cache_stats() == {"hits": 1, "misses": 1}


async def test_different_inputs_miss_cache(monkeypatch):
    """Cambiar el modelo o el mensaje invalida el caché: dos peticiones reales."""
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": "ok"}})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_router, "CACHE_ENABLED", True)
    model_router.clear_cache()

    base = [{"role": "user", "content": "hola"}]
    await model_router.call_model("cloud/qwen3:32b", base)
    await model_router.call_model("cloud/llama3.3:70b", base)  # otro modelo
    await model_router.call_model("cloud/qwen3:32b", [{"role": "user", "content": "adios"}])

    assert len(calls) == 3
    assert model_router.cache_stats()["hits"] == 0


async def test_use_cache_false_forces_fresh_call(monkeypatch):
    """use_cache=False repite la llamada aunque la entrada sea idéntica."""
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"message": {"content": "fresco"}})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_router, "CACHE_ENABLED", True)
    model_router.clear_cache()

    messages = [{"role": "user", "content": "x"}]
    await model_router.call_model("cloud/qwen3:32b", messages, use_cache=False)
    await model_router.call_model("cloud/qwen3:32b", messages, use_cache=False)

    assert len(calls) == 2


# ── NFR-6 / TC-6 · Fallback configurable ──────────────────────────────────
async def test_502_triggers_configured_fallback(monkeypatch):
    """TC-6: si el modelo cloud da 502, se reintenta con el modelo de respaldo."""
    seen_models: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        seen_models.append(model)
        if model == "qwen3:32b":  # el primario falla
            return httpx.Response(502, json={"error": "model_unavailable"})
        return httpx.Response(200, json={"message": {"content": f"respondió {model}"}})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_config, "FALLBACKS", {"cloud/qwen3:32b": "cloud/llama3.3:70b"})
    model_router.clear_cache()

    out = await model_router.call_model("cloud/qwen3:32b", [{"role": "user", "content": "hola"}])

    assert out == "respondió llama3.3:70b"
    assert seen_models == ["qwen3:32b", "llama3.3:70b"], "primero el primario, luego el respaldo"


async def test_404_model_not_found_triggers_fallback(monkeypatch):
    """NFR-6: un modelo que 'no existe' (404) también activa el fallback."""
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        seen.append(model)
        if model == "qwen3:32b":
            return httpx.Response(404, json={"error": "model not found"})
        return httpx.Response(200, json={"message": {"content": "ok-respaldo"}})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_config, "FALLBACKS", {"cloud/qwen3:32b": "cloud/llama3.3:70b"})
    model_router.clear_cache()

    out = await model_router.call_model("cloud/qwen3:32b", [{"role": "user", "content": "hi"}])
    assert out == "ok-respaldo"
    assert seen == ["qwen3:32b", "llama3.3:70b"]


async def test_429_does_not_fallback(monkeypatch):
    """429 (queue_full) NO cambia de modelo: se propaga para backoff (runbook)."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "queue_full"})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_config, "FALLBACKS", {"cloud/qwen3:32b": "cloud/llama3.3:70b"})
    model_router.clear_cache()

    with pytest.raises(httpx.HTTPStatusError):
        await model_router.call_model("cloud/qwen3:32b", [{"role": "user", "content": "hi"}])


async def test_fallback_chain_stops_no_infinite_loop(monkeypatch):
    """Un ciclo en la config de fallback no provoca recursión infinita."""
    attempts: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(json.loads(request.content)["model"])
        return httpx.Response(502, json={"error": "down"})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    # A -> B -> A (ciclo): debe intentar A y B una vez cada uno y luego rendirse.
    monkeypatch.setattr(
        model_config, "FALLBACKS",
        {"cloud/a:1": "cloud/b:1", "cloud/b:1": "cloud/a:1"},
    )
    model_router.clear_cache()

    with pytest.raises(httpx.HTTPStatusError):
        await model_router.call_model("cloud/a:1", [{"role": "user", "content": "hi"}])

    assert attempts == ["a:1", "b:1"], "cada modelo del ciclo se intenta una sola vez"


async def test_no_fallback_configured_propagates(monkeypatch):
    """Sin fallback configurado, el error del proveedor se propaga tal cual."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, json={"error": "down"})

    monkeypatch.setattr(model_router, "_client", _mock_client(handler))
    monkeypatch.setattr(model_config, "FALLBACKS", {})
    model_router.clear_cache()

    with pytest.raises(httpx.HTTPStatusError):
        await model_router.call_model("cloud/qwen3:32b", [{"role": "user", "content": "hi"}])
