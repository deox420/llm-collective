"""Tests de validación de entradas (07-security · modelo de amenazas: Tampering).

Cada endpoint que recibe texto del usuario rechaza entradas inválidas (vacías,
demasiado largas, o con parámetros fuera de rango) con 422 ANTES de adquirir el
lock global o llamar a ningún modelo.
"""
from __future__ import annotations

import httpx
import pytest

from shared import conversations
from shared.concurrency import manager


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(conversations, "_DATA_ROOT", tmp_path)


@pytest.fixture
async def client():
    from app import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _new(client, project):
    return (await client.post("/api/conversations", json={"project": project})).json()["id"]


async def test_council_rejects_empty_content(client):
    cid = await _new(client, "council")
    r = await client.post(f"/api/council/{cid}/query", json={"content": ""})
    assert r.status_code == 422
    assert not manager.is_busy()  # no se tomó el lock


async def test_council_rejects_oversized_content(client):
    cid = await _new(client, "council")
    r = await client.post(f"/api/council/{cid}/query", json={"content": "x" * 20_001})
    assert r.status_code == 422


async def test_devteam_rejects_bad_max_iterations(client):
    cid = await _new(client, "dev-team")
    r = await client.post(f"/api/devteam/{cid}/task", json={"content": "haz algo", "max_iterations": 0})
    assert r.status_code == 422
    r2 = await client.post(f"/api/devteam/{cid}/task", json={"content": "haz algo", "max_iterations": 999})
    assert r2.status_code == 422


async def test_brain_rejects_out_of_range_top_k(client):
    cid = await _new(client, "second-brain")
    r = await client.post(f"/api/secondbrain/{cid}/query", json={"content": "q", "top_k": 0})
    assert r.status_code == 422
    r2 = await client.post(f"/api/secondbrain/{cid}/query", json={"content": "q", "top_k": 1000})
    assert r2.status_code == 422


async def test_brain_rejects_empty_content(client):
    cid = await _new(client, "second-brain")
    r = await client.post(f"/api/secondbrain/{cid}/query", json={"content": ""})
    assert r.status_code == 422
