"""devteam_loader.py — importa el backend del Dev Team pese al guion en la ruta.

El paquete vive en `projects/dev-team/backend`, pero `dev-team` no es un
identificador Python válido, así que no se puede `import projects.dev-team...`.
Lo registramos una vez como paquete `devteam_backend` (con su __path__ apuntando
a esa carpeta), de modo que los imports relativos internos (`from .sandbox import`)
resuelvan con normalidad. app.py y los tests llaman a load_devteam_backend().
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

_PKG = "devteam_backend"
_DIR = pathlib.Path(__file__).resolve().parents[1] / "projects" / "dev-team" / "backend"


def load_devteam_backend():
    if _PKG in sys.modules:
        return sys.modules[_PKG]
    spec = importlib.util.spec_from_file_location(
        _PKG, _DIR / "__init__.py", submodule_search_locations=[str(_DIR)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[_PKG] = module
    spec.loader.exec_module(module)
    return module
