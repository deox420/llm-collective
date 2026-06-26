"""Integridad de la config de modelos: todos los ids tienen prefijo enrutable.

Ata shared/model_config.py al router (shared/model_router.py): si alguien añade un
modelo con un prefijo que call_model no sabe enrutar, este test lo caza.
"""
from __future__ import annotations

import pytest

from shared import model_config, model_router


def _all_model_ids(profile: dict) -> list[str]:
    ids = list(profile["council_models"])
    ids.append(profile["chairman_model"])
    ids.extend(profile["devteam_roles"].values())
    ids.append(profile["embeddings_model"])
    return ids


@pytest.mark.parametrize("profile_name", sorted(model_config.PROFILES))
def test_every_model_id_has_known_prefix(profile_name):
    for model_id in _all_model_ids(model_config.PROFILES[profile_name]):
        # No debe lanzar: el prefijo es enrutable por call_model.
        dest = model_router.destination_for(model_id)
        assert dest in model_router.KNOWN_PREFIXES.values()


def test_cloud_only_is_fully_cloud():
    # El perfil de arranque no debe depender de GPU/local salvo embeddings declarados.
    cfg = model_config.PROFILES["cloud_only"]
    council_and_chairman = list(cfg["council_models"]) + [cfg["chairman_model"]]
    council_and_chairman += list(cfg["devteam_roles"].values())
    assert all(m.startswith("cloud/") for m in council_and_chairman)


def test_active_profile_symbols_match_selected_profile():
    cfg = model_config.PROFILES[model_config.ACTIVE_PROFILE]
    assert model_config.COUNCIL_MODELS == cfg["council_models"]
    assert model_config.CHAIRMAN_MODEL == cfg["chairman_model"]
    assert model_config.DEVTEAM_ROLES == cfg["devteam_roles"]
    assert model_config.EMBEDDINGS_MODEL == cfg["embeddings_model"]
