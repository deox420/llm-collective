# Council

Ensemble democrático + peer review. Ver `docs/04-council.md` y SDD §3.1.

- N agentes (config) opinan **en paralelo** sobre la misma pregunta.
- Cada agente rankea a los **otros**, anonimizados A/B/C, sin ver sus identidades.
- El *chairman* sintetiza una respuesta final a partir de opiniones y rankings.

Tres etapas emitidas por SSE: `opinions → review → synthesis` (progreso por etapas,
nunca ETA).

## Cómo arrancar

Desde la raíz del repo (el router de Council se monta en `app.py`):

```bash
uv sync                                   # deps del núcleo
uv run uvicorn app:app --reload           # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173 (proxy a :8000)
```

No necesita extras pesados: Council solo usa el núcleo (`shared/`).

## Configuración

Qué modelos participan y quién es el chairman se leen de `shared/model_config.py`
según `MODEL_PROFILE` (no se hardcodean). Perfil por defecto `cloud_only`:

```python
COUNCIL_MODELS = ["cloud/qwen3:32b", "cloud/deepseek-r1:32b", "cloud/llama3.3:70b"]
CHAIRMAN_MODEL = "cloud/llama3.3:70b"
```

Para mover el chairman a una GPU alquilada/propia, cambia a un perfil con prefijo
`gpu/` o `local/` (`MODEL_PROFILE=cloud_plus_gpu`); no se toca código. Si un modelo
cloud falla, `call_model` reintenta con el modelo de reserva del perfil (NFR-6,
`FALLBACKS` en `model_config.py`).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/conversations` `{project:"council"}` | crea una conversación |
| POST | `/api/council/{conversation_id}/query` `{content}` | lanza la consulta (SSE) |

`content` se valida (1–20 000 caracteres). La consulta corre bajo el **lock global
de concurrencia** (un modo a la vez, ADR-0008): si otro modo está activo → `409
mode_busy`.

## Tests

```bash
uv run pytest tests/test_council_orchestrator.py tests/test_council_endpoint.py
```

Cubren quorum/paralelismo (TC-C1), anonimización (TC-C2), que el chairman recibe
todas las opiniones + rankings (TC-C3) y el flujo SSE end-to-end.
