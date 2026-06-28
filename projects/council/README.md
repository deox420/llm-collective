# Council

Ensemble democrático + peer review. Ver `docs/04-council.md` y SDD §3.1.

Tres etapas, todas vía `call_model` (regla no negociable) con los modelos del perfil
activo (`shared/model_config.py`):

1. **opinions** — N agentes responden la misma pregunta en paralelo (`asyncio.gather`). FR-C1
2. **review** — cada agente rankea a los **otros**, anonimizados A/B/C (no ve ids reales). FR-C2
3. **synthesis** — el *chairman* recibe opiniones + rankings y sintetiza la respuesta. FR-C3

## Cómo arrancar

El Council corre dentro del backend común; no tiene proceso propio.

```bash
uv sync                                  # deps del núcleo (Council no necesita extras)
uv run uvicorn app:app --reload          # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173 (vista Chat → Council)
```

## Configuración

Los modelos no se hardcodean: salen del perfil activo (`MODEL_PROFILE` en `.env`).

```python
# shared/model_config.py — perfil cloud_only (por defecto)
COUNCIL_MODELS = ["cloud/qwen3:32b", "cloud/deepseek-r1:32b", "cloud/llama3.3:70b"]
CHAIRMAN_MODEL = "cloud/llama3.3:70b"   # en cloud_plus_gpu pasa a gpu/llama3.3:70b
```

Cambiar de perfil (físico vs alquilado) = cambiar `MODEL_PROFILE`, sin tocar código.

## API (ver `docs/specs/api-spec.md`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| `POST` | `/api/conversations` `{ "project": "council" }` | crea conversación (201) |
| `POST` | `/api/council/{conversation_id}/query` `{ "content": "…" }` | flujo de 3 etapas (SSE) |

Eventos SSE: `stage1_opinion`, `stage1_complete`, `stage2_review`, `stage3_final`,
`session:done` (+ `stage:start`/`stage:done` para la escena). Un agente caído emite
`model_error` y el resto continúa.

Concurrencia: adquiere el lock global `council` (un modo a la vez, ADR-0008); si otro
modo está activo responde `409 mode_busy`. Entrada validada: `content` 1–16 000 chars.

## Tests

`uv run pytest tests/test_council_orchestrator.py tests/test_council_endpoint.py`
— quorum (3 opiniones en paralelo, sigue si una falla), anonimización sin fuga de ids,
el chairman recibe todo, parseo de rankings, más votado, SSE end-to-end + persistencia.
