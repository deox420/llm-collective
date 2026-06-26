# Dev Team

Pipeline jerárquico de roles con herramientas reales y sandbox. Ver
`docs/05-dev-team.md` y SDD §3.2.

Grafo **LangGraph** (ADR-0005): `architect → programmer → reviewer → tester`, con
**bucle de corrección** — si el tester falla, vuelve al programador hasta
`max_iterations` (FR-D4). Cada rol es un modelo con su propio system prompt
(FR-D1), invocado por `call_model`.

El tester ejecuta **pytest de verdad** dentro de un sandbox aislado (`sandbox.py`):
workdir efímero, validación de rutas anti-escape, límites de CPU/tamaño de fichero
y timeout, entorno sin secretos. Ver nota de seguridad abajo.

## Cómo arrancar

```bash
uv sync --extra devteam                   # añade LangGraph
uv run uvicorn app:app --reload           # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173
```

## Configuración

Los modelos de cada rol salen de `shared/model_config.py` (`DEVTEAM_ROLES`), por
`MODEL_PROFILE`. Perfil por defecto `cloud_only`:

```python
DEVTEAM_ROLES = {
    "architect":  "cloud/qwen3:32b",
    "programmer": "cloud/qwen3-coder:32b",
    "reviewer":   "cloud/deepseek-r1:32b",
    "tester":     "cloud/qwen3-coder:32b",   # el tester también corre pytest real
}
```

Tope del bucle: `DEFAULT_MAX_ITERATIONS` (override por petición con
`max_iterations`, acotado a 1–20).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/conversations` `{project:"dev-team"}` | crea una conversación |
| POST | `/api/devteam/{conversation_id}/task` `{content, max_iterations?}` | lanza la tarea (SSE) |

`content` se valida (1–20 000 caracteres). Corre bajo el lock global → `409
mode_busy` si otro modo está activo.

## Seguridad del sandbox (NFR-4, ADR-0009)

El SDD pide un contenedor Docker sin privilegios. En entornos sin Docker el backend
por defecto es **subprocess** con mitigaciones (rutas validadas, RLIMIT_*, timeout,
sin herencia de `.env`). Es más débil que un contenedor (no aísla red ni PIDs); la
interfaz está lista para enchufar un backend Docker sin tocar el pipeline. Detalle y
trade-off en `docs/adr/0009-sandbox-subprocess-fallback.md`.

## Tests

```bash
uv run pytest tests/test_devteam.py tests/test_devteam_endpoint.py
```

Cubren el avance del pipeline, `loop_back` tras fallo y luego pase (TC-D1), tope de
iteraciones (TC-D3), el sandbox rechaza rutas fuera del workdir (TC-D4) y corre
pytest real, y el endpoint SSE end-to-end.
