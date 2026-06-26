"""backend_loader.py — importa backends de apps cuya carpeta lleva guion.

`projects/dev-team/backend` y `projects/second-brain/backend` no son importables
por puntos (el guion no es identificador válido). Los registramos como paquetes
con nombre válido (`devteam_backend`, `secondbrain_backend`) y su __path__ correcto,
de modo que sus imports relativos internos resuelvan. app.py y los tests llaman a
estas funciones.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys

_ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_backend(pkg_name: str, app_dir: str):
    if pkg_name in sys.modules:
        return sys.modules[pkg_name]
    d = _ROOT / "projects" / app_dir / "backend"
    spec = importlib.util.spec_from_file_location(
        pkg_name, d / "__init__.py", submodule_search_locations=[str(d)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[pkg_name] = module
    spec.loader.exec_module(module)
    return module


def load_devteam_backend():
    return load_backend("devteam_backend", "dev-team")


def load_secondbrain_backend():
    return load_backend("secondbrain_backend", "second-brain")
