"""Configuración común de tests."""
import pytest

from shared import model_router
from shared.backend_loader import load_devteam_backend, load_secondbrain_backend

# Registra los backends con guion en la ruta como paquetes importables.
load_devteam_backend()
load_secondbrain_backend()


@pytest.fixture(autouse=True)
def _clear_model_cache():
    """La caché de respuestas (FR-5) es global por proceso; aislar entre tests."""
    model_router.clear_cache()
    yield
    model_router.clear_cache()
