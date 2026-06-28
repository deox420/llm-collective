# Spec · Trazabilidad de requisitos

Cierre de la Fase 7: cada requisito de [`01-requirements.md`](../01-requirements.md) con
su implementación y su prueba, o anotado si queda fuera del alcance de esta entrega.

Estado: ✅ implementado y probado · 🟡 implementado, verificación real bloqueada por
entorno (egress a `ollama.com`) · ⏸️ en standby (decisión de esta entrega) · ⛔ no
implementado (anotado).

## Funcionales — comunes

| ID | Estado | Implementación | Prueba |
|----|--------|----------------|--------|
| FR-1 | ✅ | `shared/model_router.py` (`destination_for`, `call_model`, `_dispatch`) | `tests/test_model_router.py` (TC-1, TC-2) |
| FR-2 | ✅ | `shared/sse.py` (`StageEmitter`) + routers de cada app | `tests/test_sse.py`, `tests/test_*_endpoint.py` (TC-3) |
| FR-3 | ✅ | `shared/conversations.py` + `POST/GET /api/conversations` | `tests/test_council_endpoint.py` (TC-4) |
| FR-4 | ✅ | `frontend/src/App.jsx` (sidebar + cambio de modo) + `shared/concurrency.py` | `tests/test_concurrency.py`; verificación visual (Fase 2) |
| FR-5 | ✅ | `shared/model_router.py` (`_cache`, `_cache_key`, `cache_stats`) | `tests/test_router_resilience.py` (TC-5) |

## Funcionales — Council

| ID | Estado | Implementación | Prueba |
|----|--------|----------------|--------|
| FR-C1 | ✅ | `orchestrator._gather_opinions` (`asyncio.gather`) | `tests/test_council_orchestrator.py` (TC-C1) |
| FR-C2 | ✅ | `orchestrator.anonymize`, `_cross_review` | `tests/test_council_orchestrator.py` (TC-C2) |
| FR-C3 | ✅ | `orchestrator._synthesize` (chairman) | `tests/test_council_orchestrator.py` (TC-C3) |
| FR-C4 | ✅ | `frontend` `CouncilChatView` (tabs + revisión) | verificación visual |

## Funcionales — Dev Team

| ID | Estado | Implementación | Prueba |
|----|--------|----------------|--------|
| FR-D1 | ✅ | `pipeline.py` (un modelo + system prompt por rol) | `tests/test_devteam.py` |
| FR-D2 | ✅ | `pipeline.py` (grafo LangGraph, `loop_back` tester→programmer) | `tests/test_devteam.py` (TC-D1) |
| FR-D3 | ✅ | `sandbox.py` (workdir efímero, anti-escape, rlimits) | `tests/test_devteam.py` (TC-D2, TC-D4) |
| FR-D4 | ✅ | `pipeline.MAX_FIX_ITERATIONS` + tope `MAX_ITERATIONS_CAP` en el router | `tests/test_devteam.py` (TC-D3) |
| FR-D5 | ✅ | `frontend` `DevTeamView` (estados del pipeline) | verificación visual |

## Funcionales — Second Brain

| ID | Estado | Implementación | Prueba |
|----|--------|----------------|--------|
| FR-S1 | ✅ | `chunker.py`, `store.py`, `indexer.py` | `tests/test_secondbrain.py` (TC-S1) |
| FR-S2 | ✅ | `indexer.py` (plan incremental por `mtime`) | `tests/test_secondbrain.py` (TC-S2) |
| FR-S3 | ✅ | `retriever.answer_query` | `tests/test_secondbrain.py` (TC-S3) |
| FR-S4 | ✅ | `retriever.py` (citas a notas reales) | `tests/test_secondbrain.py` (TC-S3) |
| FR-S5 | ✅ | `router.require_tunnel` (loopback o token) | `tests/test_secondbrain_endpoint.py` (TC-S5) |
| FR-S6 | ⛔ | overlay de council sobre notas — `Could`, no implementado | — (anotado; flag `council_overlay` aceptado pero inactivo) |

## No funcionales

| ID | Estado | Implementación / nota | Prueba |
|----|--------|-----------------------|--------|
| NFR-1 | 🟡 | Council 3 agentes en paralelo; p50 < 60 s solo medible con modelos reales | E2E manual (bloqueado por egress) |
| NFR-2 | ✅ | `asyncio.gather` en etapa 1 (no se serializa) | `tests/test_council_orchestrator.py` |
| NFR-3 | 🟡 | Embeddings/vector DB locales por diseño; en `cloud_only` el embedding sale a cloud (documentado) | revisión de tráfico (TC-S4, manual) |
| NFR-4 | ✅ | `sandbox.py` aísla la ejecución (subprocess; Docker pendiente, ADR-0009) | `tests/test_devteam.py` (TC-D4) |
| NFR-5 | ✅ | GPU bajo demanda + caché de respuestas (FR-5); palancas en `08-costs.md` | — (operacional) |
| NFR-6 | ✅ | `model_router` fallback configurable + `model_config.FALLBACKS`/`fallback_for` | `tests/test_router_resilience.py` (TC-6) |
| NFR-7 | ✅ | Toda invocación de modelo pasa por `shared/model_router.py` | revisión de código (grep `call_model`) |
| NFR-8 | ✅ | Progreso por etapas vía SSE (`StageEmitter`), nunca espera ciega | `tests/test_sse.py` |
| NFR-9 | ✅ | `uv sync` + `npm install` + `start.sh` (sin pasos manuales extra) | arranque manual |

## Restricciones

| ID | Estado | Implementación / nota |
|----|--------|-----------------------|
| CON-1 | ✅ | Lock global de modo único (≤1 modo activo) coherente con el límite de 3 slots cloud; ADR-0008 |
| CON-2 | 🟡 | El chairman debe caber en VRAM: decisión de perfil (`model_config`) + nota en `09-operations.md` |
| CON-3 | ✅ | Acceso remoto solo por túnel (`require_tunnel`), nunca puerto abierto; ADR-0006 |
| CON-4 | ✅ | Entrega por rama/PR en este entorno (hay conector de GitHub); CON original asumía su ausencia |

## Standby de esta entrega

| Área | Estado | Motivo |
|------|--------|--------|
| Sprites pixel-art (PixelLab) de la vista interactiva | ⏸️ | MCP no conectado + `api.pixellab.ai` bloqueado por egress. El contrato `SceneTheme` y los placeholders funcionan; sustituir los sprites es solo cambiar `assets` en `frontend/src/scenes.js` (SDD §13.5). |
| Corridas con modelos reales / `verify_models` | 🟡 | Egress a `ollama.com` bloqueado (403). Verificado todo con modelos *faked*; con acceso real el flujo es idéntico. |
