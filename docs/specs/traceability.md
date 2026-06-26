# Spec · Trazabilidad de requisitos (verificación final · Fase 7)

Cada requisito `Must`/`Should`/`Could` de [01-requirements](../01-requirements.md)
con su implementación y la prueba que lo cubre. Rutas relativas a la raíz del repo.

Estado: ✅ implementado y probado · 🟡 implementado, prueba parcial / E2E manual ·
⛔ bloqueado por el entorno (no por el código).

## Requisitos funcionales — comunes

| ID | Prio | Implementación | Prueba | Estado |
|----|------|----------------|--------|--------|
| FR-1 | Must | `shared/model_router.py` (`destination_for`, `call_model`, prefijos `cloud/gpu/local/anthropic`) | `tests/test_model_router.py` (TC-1, TC-2) | ✅ |
| FR-2 | Must | `shared/sse.py` (`StageEmitter`); routers devuelven `StreamingResponse` SSE | `tests/test_sse.py`, `tests/test_*_endpoint.py` (TC-3) | ✅ |
| FR-3 | Must | `shared/conversations.py` (persistencia JSON) + endpoints `/api/conversations` | `tests/test_council_endpoint.py` (TC-4) | ✅ |
| FR-4 | Must | `frontend/src/App.jsx` (sidebar 3 modos + Hub), `api.js` | smoke Playwright (Fase 2) | 🟡 |
| FR-5 | Should | caché en `call_model` (`_cache`, `use_cache`) (ADR-0010) | `tests/test_model_router.py::test_identical_calls_hit_cache_once` (TC-5) | ✅ |

## Council

| ID | Prio | Implementación | Prueba | Estado |
|----|------|----------------|--------|--------|
| FR-C1 | Must | `projects/council/backend/orchestrator.py::_gather_opinions` (`asyncio.gather`) | `tests/test_council_orchestrator.py` (TC-C1) | ✅ |
| FR-C2 | Must | `orchestrator.py::anonymize` + `_cross_review` (anon A/B/C) | `test_council_orchestrator.py` (TC-C2) | ✅ |
| FR-C3 | Must | `orchestrator.py::_synthesize` (chairman recibe opiniones + rankings) | `test_council_orchestrator.py` (TC-C3) | ✅ |
| FR-C4 | Should | `frontend/src/App.jsx` (tabs de opiniones + panel de revisión) | smoke Playwright (Fase 3) | 🟡 |

## Dev Team

| ID | Prio | Implementación | Prueba | Estado |
|----|------|----------------|--------|--------|
| FR-D1 | Must | `projects/dev-team/backend/pipeline.py` (system prompt por rol) | `tests/test_devteam.py` | ✅ |
| FR-D2 | Must | `pipeline.py` (grafo LangGraph con bucle tester→programmer) | `test_devteam.py` (TC-D1) | ✅ |
| FR-D3 | Must | `projects/dev-team/backend/sandbox.py` (workdir, rutas validadas, RLIMIT) | `test_devteam.py` (TC-D2, TC-D4) | ✅ |
| FR-D4 | Must | `pipeline.py` (`MAX_FIX_ITERATIONS`) + validación `max_iterations` 1–20 | `test_devteam.py` (TC-D3), `test_input_validation.py` | ✅ |
| FR-D5 | Should | `frontend/src/App.jsx` (estados del pipeline) | smoke Playwright (Fase 4) | 🟡 |

## Second Brain

| ID | Prio | Implementación | Prueba | Estado |
|----|------|----------------|--------|--------|
| FR-S1 | Must | `chunker.py` + `store.py` + `indexer.py` (chunks + embeddings) | `tests/test_secondbrain.py` (TC-S1) | ✅ |
| FR-S2 | Must | `indexer.py` (reindex incremental por `mtime`) | `test_secondbrain.py` (TC-S2) | ✅ |
| FR-S3 | Must | `retriever.py::answer_query` (top_k + síntesis) | `test_secondbrain.py` (TC-S3) | ✅ |
| FR-S4 | Must | `retriever.py` (citas a notas) | `test_secondbrain.py`, `test_secondbrain_endpoint.py` | ✅ |
| FR-S5 | Should | `second-brain/backend/router.py::require_tunnel` | `test_secondbrain.py` (TC-S5) | ✅ |
| FR-S6 | Could | parámetro `council_overlay` reservado en `QueryIn` (sin overlay aún) | — | 🟡 |

## Requisitos no funcionales

| ID | Implementación | Prueba | Estado |
|----|----------------|--------|--------|
| NFR-1 (latencia p50 <60s) | opiniones en paralelo (`gather`) | E2E manual con modelos reales (TC-C4) | ⛔ egress a ollama.com |
| NFR-2 (etapa 1 no serializa) | `_gather_opinions` con `asyncio.gather` | `test_council_orchestrator.py` (TC-C1) | ✅ |
| NFR-3 (datos no salen) | embeddings/vector DB locales; perfil `local_dev`/`cloud_plus_gpu` con `local/nomic-embed-text` | revisión de tráfico (TC-S4) | 🟡 revisión |
| NFR-4 (sin código en host) | `sandbox.py` (subprocess + mitigaciones; Docker pendiente, ADR-0009) | `test_devteam.py` (TC-D4) | ✅ |
| NFR-5 (coste) | perfiles cloud/local/gpu + caché (FR-5); notas en `08-costs.md` | revisión | ✅ |
| NFR-6 (fallback) | `call_model` reintenta con `model_config.FALLBACKS` (ADR-0010) | `test_model_router.py::test_502_triggers_configured_fallback` (TC-6) | ✅ |
| NFR-7 (invocación centralizada) | toda llamada por `shared/model_router.call_model` | grep: ningún proveedor llamado directo desde apps | ✅ |
| NFR-8 (progreso incremental) | SSE por etapas; barra `StageProgress` | `test_sse.py`, smoke | ✅ |
| NFR-9 (setup sin pasos manuales) | `uv sync` + `npm install` + `start.sh` | — | ✅ |

## Restricciones

| ID | Cómo se respeta | Estado |
|----|-----------------|--------|
| CON-1 (3 concurrentes Pro) | lock global de modo único (`shared/concurrency.py`, ADR-0008): un modo ya satura los 3 slots | ✅ |
| CON-2 (chairman cabe en VRAM) | elección de modelo por perfil; nota de dimensionamiento en `08-costs.md` | 🟡 operativo |
| CON-3 (sin puerto abierto) | `require_tunnel` (FR-S5, ADR-0006); `09-operations.md` exige túnel | ✅ |
| CON-4 (sin conector GitHub en build) | histórico; en esta sesión sí hay integración GitHub | n/a |

## Bloqueos del entorno (no del código)

Verificado todo con modelos/embeddings *faked*. Con egress real el flujo es idéntico.

1. **`ollama.com` (403 egress):** sin corridas reales de modelos/embeddings ni
   `python -m shared.verify_models`. Afecta a la medición de NFR-1 (TC-C4) y a la
   verificación de nombres de modelo del perfil `cloud_only`.
2. **`api.pixellab.ai` (403) + MCP PixelLab:** sprites pixel-art de la Fase 6
   (placeholders con el mismo contrato `SceneTheme`).

## Criterios de salida (test-plan §criterios)

- Casos `Must` del plan de pruebas: en verde (núcleo, council, dev-team, second-brain).
- Sin escapes del sandbox (TC-D4) ✅. Sin fugas de secretos en logs/respuestas
  (revisión: `health.py` solo booleanos; `verify_models` imprime nombres, no claves;
  Bearer nunca se loguea).
- TC-S4 (no fuga de datos a terceros): garantizado por diseño con perfil local; en
  `cloud_only` los embeddings sí salen a Ollama Cloud (documentado, NFR-3 condicional).
