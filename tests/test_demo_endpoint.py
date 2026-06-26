"""Tests del endpoint demo SSE del shell (Fase 2): lock global + etapas por SSE."""
from __future__ import annotations

import httpx
import pytest

from app import app
from shared.concurrency import manager


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_unknown_mode_returns_404(client):
    r = await client.post("/api/demo/nope/run")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "unknown_mode"


async def test_busy_mode_returns_409(client):
    # Simula un modo ya activo y comprueba el bloqueo global (ADR-0008).
    await manager.acquire("devteam")
    try:
        r = await client.post("/api/demo/council/run")
        assert r.status_code == 409
        body = r.json()["error"]
        assert body["code"] == "mode_busy"
        assert body["active_mode"] == "devteam"
    finally:
        await manager.release("devteam")


async def test_status_reflects_active_mode(client):
    r = await client.get("/api/status")
    assert r.status_code == 200
    assert r.json()["active_mode"] is None
    assert set(r.json()["modes"]) == {"council", "devteam", "brain"}


async def test_demo_stream_emits_stages_in_order_and_releases(client):
    events: list[str] = []
    async with client.stream("POST", "/api/demo/brain/run") as r:
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/event-stream")
        async for line in r.aiter_lines():
            if line.startswith("event:"):
                events.append(line[len("event:"):].strip())

    # brain: retrieval -> synthesis, terminando en session:done.
    assert events == [
        "stage:start", "stage:done",   # retrieval
        "stage:start", "stage:done",   # synthesis
        "session:done",
    ]
    # El lock debe quedar liberado tras completar el stream.
    assert not manager.is_busy()
