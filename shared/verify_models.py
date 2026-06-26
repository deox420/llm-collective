"""verify_models.py — comprueba que los modelos del perfil existen en Ollama Cloud.

Fase 1 del IMPLEMENTATION_PLAN: "verifica que los nombres de modelo del perfil existen
de verdad en tu cuenta de Ollama Cloud y ajústalos si no". Esta utilidad solo COMPRUEBA
y reporta; el ajuste (editar shared/model_config.py) es manual y deliberado.

Requiere OLLAMA_CLOUD_API_KEY en el entorno/.env. No imprime la clave (local-first:
nada de secretos en logs).

Uso:
    uv run python -m shared.verify_models            # perfil activo (MODEL_PROFILE)
    uv run python -m shared.verify_models cloud_only # un perfil concreto
"""
from __future__ import annotations

import asyncio
import os
import sys

import httpx

from shared import model_config


def _profile_cloud_models(profile_name: str) -> list[str]:
    """Modelos con prefijo cloud/ del perfil, sin el prefijo (nombre Ollama)."""
    cfg = model_config.PROFILES[profile_name]
    ids = list(cfg["council_models"]) + [cfg["chairman_model"]]
    ids += list(cfg["devteam_roles"].values()) + [cfg["embeddings_model"]]
    return sorted({m.split("/", 1)[1] for m in ids if m.startswith("cloud/")})


async def fetch_cloud_model_names(host: str, api_key: str) -> set[str]:
    """Lista los modelos disponibles en el host Ollama (cloud) vía GET /api/tags."""
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{host}/api/tags", headers=headers)
        r.raise_for_status()
        data = r.json()
    return {m.get("name", "") for m in data.get("models", [])}


def _matches(wanted: str, available: set[str]) -> bool:
    # Ollama lista nombres como "qwen3:32b" o "qwen3:32b" (a veces con ":latest").
    if wanted in available:
        return True
    if ":" not in wanted and f"{wanted}:latest" in available:
        return True
    return False


async def verify(profile_name: str) -> int:
    if profile_name not in model_config.PROFILES:
        print(f"perfil desconocido: {profile_name!r}. Opciones: {sorted(model_config.PROFILES)}")
        return 2

    api_key = os.environ.get("OLLAMA_CLOUD_API_KEY", "")
    host = os.environ.get("OLLAMA_CLOUD_HOST", "https://ollama.com")
    wanted = _profile_cloud_models(profile_name)

    print(f"Perfil: {profile_name} · host: {host}")
    print(f"Modelos cloud/ a verificar: {wanted}")

    if not api_key:
        print("\n[BLOQUEADO] Falta OLLAMA_CLOUD_API_KEY en el entorno/.env.")
        print("Rellena la clave y vuelve a ejecutar para comprobar contra tu cuenta.")
        return 3

    try:
        available = await fetch_cloud_model_names(host, api_key)
    except httpx.HTTPError as e:
        print(f"\n[ERROR] No se pudo consultar el catálogo de Ollama Cloud: {e!r}")
        return 4

    missing = [m for m in wanted if not _matches(m, available)]
    for m in wanted:
        print(f"  {'OK ' if m not in missing else 'FALTA'}  {m}")

    if missing:
        print(f"\n[FALTAN] {len(missing)} modelo(s) no están en tu cuenta: {missing}")
        print("Ajusta shared/model_config.py con nombres válidos de tu catálogo.")
        return 1
    print("\n[OK] Todos los modelos cloud/ del perfil existen en tu cuenta.")
    return 0


def main() -> None:
    profile = sys.argv[1] if len(sys.argv) > 1 else model_config.ACTIVE_PROFILE
    raise SystemExit(asyncio.run(verify(profile)))


if __name__ == "__main__":
    main()
