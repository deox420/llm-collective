"""Tests del router call_model (TC-1, TC-2, FR-1, ADR-0003).

Se mockea el transporte httpx para no tocar la red: cada test inspecciona a qué
host se enrutó la llamada y cómo se adaptó el payload.
"""
from __future__ import annotations

import json

import httpx
import pytest

from shared import model_router


@pytest.fixture
def captured(monkeypatch):
    """Sustituye el cliente httpx del router por uno con MockTransport.

    Devuelve una lista donde se registran las peticiones (host, ruta, headers, body)
    para poder hacer aserciones sobre el enrutado y la adaptación del payload.
    """
    requests: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else {}
        requests.append(
            {
                "url": str(request.url),
                "host": request.url.host,
                "path": request.url.path,
                "headers": dict(request.headers),
                "body": body,
            }
        )
        if request.url.path.endswith("/v1/messages"):  # Anthropic
            return httpx.Response(200, json={"content": [{"text": "respuesta-anthropic"}]})
        return httpx.Response(200, json={"message": {"content": "respuesta-ollama"}})

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(model_router, "_client", mock_client)
    return requests


def test_destination_for_known_and_unknown():
    assert model_router.destination_for("cloud/qwen3:32b") == "cloud"
    assert model_router.destination_for("gpu/llama3.3:70b") == "gpu"
    assert model_router.destination_for("local/mistral:7b") == "local"
    assert model_router.destination_for("anthropic/claude-x") == "anthropic"
    with pytest.raises(ValueError):
        model_router.destination_for("bogus/model")


async def test_cloud_routes_to_cloud_host(captured, monkeypatch):
    monkeypatch.setattr(model_router, "OLLAMA_CLOUD_API_KEY", "testkey")
    out = await model_router.call_model(
        "cloud/qwen3:32b", [{"role": "user", "content": "hola"}]
    )
    assert out == "respuesta-ollama"
    req = captured[-1]
    assert req["host"] == "ollama.com"
    assert req["path"] == "/api/chat"
    # El nombre de modelo va sin el prefijo.
    assert req["body"]["model"] == "qwen3:32b"
    assert req["body"]["stream"] is False
    # La API key viaja como Bearer (TC: auth cloud).
    assert req["headers"].get("authorization") == "Bearer testkey"


async def test_unknown_prefix_raises_value_error(captured):
    with pytest.raises(ValueError):
        await model_router.call_model("bogus/x", [{"role": "user", "content": "hi"}])
    assert captured == []  # no debe llegar a hacer ninguna petición


async def test_gpu_without_host_raises_runtime_error(captured, monkeypatch):
    monkeypatch.setattr(model_router, "GPU_HOST", "")
    with pytest.raises(RuntimeError):
        await model_router.call_model("gpu/llama3.3:70b", [{"role": "user", "content": "hi"}])
    assert captured == []


async def test_gpu_routes_to_gpu_host(captured, monkeypatch):
    monkeypatch.setattr(model_router, "GPU_HOST", "http://gpu.local:11434")
    await model_router.call_model("gpu/llama3.3:70b", [{"role": "user", "content": "hi"}])
    req = captured[-1]
    assert req["host"] == "gpu.local"
    assert req["path"] == "/api/chat"
    assert req["body"]["model"] == "llama3.3:70b"


async def test_local_routes_to_local_host(captured, monkeypatch):
    monkeypatch.setattr(model_router, "LOCAL_HOST", "http://localhost:11434")
    await model_router.call_model("local/mistral:7b", [{"role": "user", "content": "hi"}])
    req = captured[-1]
    assert req["host"] == "localhost"
    assert req["path"] == "/api/chat"
    assert req["body"]["model"] == "mistral:7b"


async def test_anthropic_adapts_payload(captured, monkeypatch):
    # TC-2: system separado + max_tokens; el mensaje system no va en messages.
    monkeypatch.setattr(model_router, "ANTHROPIC_API_KEY", "antkey")
    out = await model_router.call_model(
        "anthropic/claude-sonnet",
        [
            {"role": "system", "content": "eres útil"},
            {"role": "user", "content": "hola"},
        ],
        max_tokens=512,
    )
    assert out == "respuesta-anthropic"
    req = captured[-1]
    assert req["host"] == "api.anthropic.com"
    assert req["body"]["system"] == "eres útil"
    assert req["body"]["max_tokens"] == 512
    assert all(m["role"] != "system" for m in req["body"]["messages"])
    assert req["headers"].get("x-api-key") == "antkey"
