# Dev Team

Pipeline jerárquico de roles con herramientas reales y sandbox. Ver `docs/05-dev-team.md`
y SDD §3.2. Orquestado con **LangGraph** (ADR-0005).

```
architect → programmer → reviewer → tester ──(tests fallan)──► programmer ↺
                                        └────(tests pasan)────► delivery
```

- Cada rol es un modelo con system prompt propio (FR-D1), invocado por `call_model`.
- El **tester ejecuta pytest de verdad** dentro del sandbox; si falla, vuelve al
  programador (FR-D2) hasta `max_iterations` (FR-D4, tope configurable y acotado a 20).

## Sandbox (FR-D3, NFR-4)

`backend/sandbox.py`: workdir efímero, validación de rutas anti-escape, `RLIMIT_CPU`/
`RLIMIT_FSIZE` + timeout, entorno sin secretos. **Backend subprocess** (no Docker) en
este entorno: ver **ADR-0009** (la interfaz está lista para cambiar a Docker sin tocar
los roles).

## Cómo arrancar

Necesita el extra `devteam` (LangGraph):

```bash
uv sync --extra devteam
uv run uvicorn app:app --reload          # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173 (vista Chat → Dev Team)
```

## Configuración

```python
# shared/model_config.py — perfil cloud_only (por defecto)
DEVTEAM_ROLES = {
    "architect":  "cloud/qwen3:32b",
    "programmer": "cloud/qwen3-coder:32b",
    "reviewer":   "cloud/deepseek-r1:32b",
    "tester":     "cloud/qwen3-coder:32b",
}
```

En `cloud_plus_gpu` el arquitecto pasa a `gpu/qwen3:72b`. Cambiar perfil = cambiar
`MODEL_PROFILE`, sin tocar código.

## API (ver `docs/specs/api-spec.md`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| `POST` | `/api/conversations` `{ "project": "dev-team" }` | crea conversación (201) |
| `POST` | `/api/devteam/{conversation_id}/task` `{ "content": "…", "max_iterations": 5 }` | pipeline (SSE) |

Eventos SSE: `role_start`, `role_output`, `tool_call`, `test_result`, `loop_back`,
`delivery`, `session:done`. Concurrencia: lock global `devteam` (`409 mode_busy` si
otro modo corre). Entrada validada: `content` 1–16 000 chars, `max_iterations` 1–20.

## Tests

`uv run pytest tests/test_devteam.py tests/test_devteam_endpoint.py` — el sandbox
rechaza escapes de ruta (TC-D4), corre pytest real, el pipeline avanza, `loop_back`
tras fallo y luego pasa (TC-D1), tope de iteraciones (TC-D3), SSE + persistencia.
