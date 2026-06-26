"""Test del endpoint Dev Team SSE end-to-end (routing + persistencia)."""
from __future__ import annotations

import httpx
import pytest

import devteam_backend.pipeline as pipeline
from shared import conversations
from tests.test_devteam import make_fake


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(conversations, "_DATA_ROOT", tmp_path)
    monkeypatch.setattr(pipeline, "call_model", make_fake())


@pytest.fixture
async def client():
    from app import app
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_devteam_task_streams_and_persists(client):
    cid = (await client.post("/api/conversations", json={"project": "dev-team"})).json()["id"]
    events = []
    async with client.stream("POST", f"/api/devteam/{cid}/task", json={"content": "suma(a,b)", "max_iterations": 4}) as r:
        assert r.status_code == 200
        async for line in r.aiter_lines():
            if line.startswith("event:"):
                events.append(line[len("event:"):].strip())

    assert "role_start" in events
    assert "test_result" in events
    assert "delivery" in events
    assert events[-1] == "session:done"

    conv = (await client.get(f"/api/conversations/{cid}")).json()
    sd = conv["messages"][-1]["stage_data"]
    assert sd["tests_passed"] is True
    assert "solution.py" in sd["files"]
    assert "roles" in sd and "programmer" in sd["roles"]


async def test_devteam_wrong_project_400(client):
    cid = (await client.post("/api/conversations", json={"project": "council"})).json()["id"]
    r = await client.post(f"/api/devteam/{cid}/task", json={"content": "x"})
    assert r.status_code == 400
