"""Configuración común de tests."""
import pytest

from shared.backend_loader import load_devteam_backend, load_secondbrain_backend

# Registra los backends con guion en la ruta como paquetes importables.
load_devteam_backend()
load_secondbrain_backend()


@pytest.fixture(autouse=True)
def _clear_model_cache():
    """Aísla el caché de respuestas (FR-5) entre tests: es un singleton de proceso.

    Sin esto, una respuesta cacheada en un test podría servirse en otro y hacer que
    una aserción sobre "se hizo la petición HTTP" fallara de forma intermitente.
    """
    from shared import model_router

    model_router.clear_cache()
    yield
    model_router.clear_cache()
