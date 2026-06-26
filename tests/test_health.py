"""Test del endpoint de salud (DoD Fase 0: /health responde 200)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health_root_returns_200():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_api_health_matches_contract():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Contrato api-spec: models con un booleano por destino.
    models = body["models"]
    assert set(models) >= {"cloud", "gpu", "local", "anthropic"}
    assert all(isinstance(v, bool) for v in models.values())


def test_health_leaks_no_secrets():
    # local-first: la respuesta de salud no debe contener claves ni hosts.
    text = client.get("/api/health").text.lower()
    for needle in ("api_key", "bearer", "ollama.com", "authorization", "://"):
        assert needle not in text
