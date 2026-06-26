"""Tests triviales de arranque (Fase 0): el núcleo importa y el perfil carga."""
from __future__ import annotations

import pytest

from shared import model_config, model_router


def test_active_profile_is_valid():
    assert model_config.ACTIVE_PROFILE in model_config.PROFILES


def test_profile_exposes_role_models():
    # Las apps importan estos símbolos; deben existir y no estar vacíos.
    assert model_config.COUNCIL_MODELS
    assert model_config.CHAIRMAN_MODEL
    assert set(model_config.DEVTEAM_ROLES) >= {
        "architect",
        "programmer",
        "reviewer",
        "tester",
    }
    assert model_config.EMBEDDINGS_MODEL
    # describe() no debe filtrar secretos: solo nombres de modelo y perfil.
    assert model_config.describe().startswith("profile=")


async def test_call_model_rejects_unknown_prefix():
    # Contrato del router (api-spec: unknown_model_prefix). Test completo en Fase 1.
    with pytest.raises(ValueError):
        await model_router.call_model("bogus/model", [{"role": "user", "content": "hi"}])
