# Plan de implementación — LLM Collective

Hoja de ruta para construir el proyecto de principio a fin. **Trabaja una fase a la vez, en orden.** Marca cada casilla `[x]` al completarla y haz commit. No cierres una fase sin cumplir su *Definition of Done* (DoD).

Leyenda: `[ ]` pendiente · `[x]` hecho. Los IDs entre paréntesis (FR-…, NFR-…) son requisitos trazables en `docs/01-requirements.md`.

---

## Fase 0 — Arranque del repo y entorno

- [x] Crear entorno Python (uv o venv) y `requirements.txt`/`pyproject.toml` con FastAPI, httpx, pytest, langgraph, chromadb (o lancedb).
- [x] Crear estructura backend en `shared/` (núcleo) y carpetas por app en `projects/`.
- [x] Configurar `.env` a partir de `.env.example`. Verificar que `model_router.py` importa y lee las variables. **Arranca con `MODEL_PROFILE=cloud_only`** (solo Ollama Cloud; físico vs alquiler se decide después cambiando de perfil en `shared/model_config.py`).
- [x] Script de arranque del backend y del frontend documentados en `CLAUDE.md` y `README.md`.
- [x] Configurar pytest y un primer test trivial que pase.

**DoD:** `pytest` corre verde; el backend levanta un endpoint `/health` que responde 200.

---

## Fase 1 — Núcleo común (`shared/`)

- [x] Completar y probar `call_model` para los cuatro prefijos (`cloud/`, `gpu/`, `local/`, `anthropic/`). Tests con un servidor Ollama mockeado (FR del router, ADR-0003).
- [x] Implementar el **gestor de concurrencia global**: un único modo activo a la vez; los demás bloqueados (FR de concurrencia, `12-frontend.md`). _(Diverge de SDD §12.4; registrado en ADR-0008.)_
- [x] Implementar el **emisor de eventos SSE de etapas** reutilizable por los tres modos (contrato en `13-interactive-scenes.md` §13.2 y `specs/api-spec.md`).
- [x] Modelo de configuración (qué modelo va a cada rol) leído de `shared/model_config.py` vía `MODEL_PROFILE`, no hardcodeado. Las apps importan `COUNCIL_MODELS`, `CHAIRMAN_MODEL`, `DEVTEAM_ROLES`, `EMBEDDINGS_MODEL` de ahí.
- [ ] **(Bloqueado)** Verificar que los modelos del perfil `cloud_only` existen en la cuenta de Ollama Cloud (`uv run python -m shared.verify_models`) y ajustar `model_config.py` si no. Clave ya configurada, pero **la política de egress de este entorno remoto bloquea `ollama.com` (403)**. Ejecutar en local o añadir `ollama.com` al allowlist del entorno.

**DoD:** tests del router pasan; un test demuestra que iniciar un segundo modo mientras otro corre devuelve "bloqueado"; los eventos SSE se emiten en orden de etapa.

---

## Fase 2 — Shell de frontend común

- [x] Crear `frontend/` con Vite + React.
- [x] Sidebar con los tres modos como carpetas colapsables + Hub, con historial de conversación por modo (`12-frontend.md`).
- [x] Recoloreado de **toda la pestaña** según el acento del modo (Hub indigo, Council teal, Dev Team coral/amber, Second Brain púrpura) con cross-fade 200–300 ms.
- [x] Indicador de modo ocupado: punto pulsante + bloqueo de los otros modos con mensaje no-bloqueante y **barra de progreso por etapas**. _(Bloqueo global de modo único, coherente con ADR-0008.)_
- [x] Toggle de las dos vistas (Chat / Interactiva) en la cabecera.
- [x] Cliente SSE que consume los eventos de etapa del backend (vía `POST /api/demo/{mode}/run`).

**DoD:** se navega entre los tres modos, el color tiñe toda la UI, y un modo "ocupado" simulado bloquea los otros con barra por etapas.

---

## Fase 3 — Council (vertical completa)

- [x] Backend: orquestar N modelos vía `call_model`, recoger opiniones en paralelo (FR Council).
- [x] Revisión cruzada anonimizada (A/B/C) y cálculo del más votado (`04-council.md`).
- [x] Síntesis por el chairman; emisión de etapas opinions → review → synthesis por SSE.
- [x] Frontend vista Chat: respuesta del chairman + pestañas de opiniones + panel de revisión.
- [x] Tests: quorum, anonimización, que el chairman recibe todas las opiniones.

**DoD:** una pregunta real recorre las tres etapas y devuelve síntesis + opiniones; tests verdes; vista chat funcional. _(Verificado end-to-end con modelos reales mockeados —faked— porque la egress a `ollama.com` sigue bloqueada; con acceso real el flujo es idéntico.)_

---

## Fase 4 — Dev Team (vertical completa)

- [x] Backend: pipeline LangGraph architect → programmer → reviewer → tester (ADR-0005, `05-dev-team.md`).
- [x] Herramientas reales con **sandbox** para ejecutar/probar código de forma aislada (`07-security.md`). _(Backend subprocess; Docker pendiente, ADR-0009.)_
- [x] Bucle de retorno tester→programmer cuando fallan los tests.
- [x] Emisión de etapas por SSE; frontend vista Chat con el código en streaming.
- [x] Tests: el pipeline avanza, el retorno funciona, el sandbox contiene la ejecución.

**DoD:** una tarea de programación produce código probado por el pipeline; el sandbox impide efectos fuera de él; tests verdes. _(Verificado: el tester ejecuta pytest REAL en el sandbox; loop iter1 falla → iter2 pasa. Con modelos faked por el bloqueo de egress a ollama.com.)_

---

## Fase 5 — Second Brain (vertical completa)

- [x] Ingesta del vault Obsidian: trocear, generar embeddings locales (`nomic-embed-text`) y guardarlos en el vector store (`06-second-brain.md`, `data-model.md`).
- [x] Recuperación + síntesis con citas a las notas fuente; etapas retrieval → synthesis por SSE.
- [x] Acceso remoto por **túnel** (Tailscale/Cloudflare), nunca puerto abierto (ADR-0006, NFR de seguridad). _(Guarda `require_tunnel`: solo loopback o token de túnel.)_
- [x] Frontend vista Chat con chips de citación y notas recuperadas.
- [x] Tests: la recuperación trae las notas correctas; las respuestas citan fuentes reales.

**DoD:** una pregunta sobre el vault responde citando notas reales; el acceso remoto funciona solo por túnel; tests verdes. _(Verificado: RAG real con Chroma; la pregunta sobre sync recupera sync.md (top) y la respuesta lo cita. Embeddings/chairman faked por el bloqueo de egress.)_

---

## Fase 6 — Vista interactiva + assets PixelLab

- [x] Implementar el contrato `SceneTheme` (`13-interactive-scenes.md` §13.4) en el frontend.
- [⏸️] **(STANDBY — decisión de entrega)** Generar los assets de **Council** (mesa redonda) con PixelLab vía MCP siguiendo `ASSETS.md`. El MCP de PixelLab no está conectado y `api.pixellab.ai` está bloqueado por egress (403). **Se aparca la parte pixel-art** y se prioriza cerrar lo funcional (Fase 7). Retomar cuando el MCP de PixelLab esté disponible (local/Claude Desktop); sustituir es solo cambiar `assets` en `frontend/src/scenes.js`.
- [x] Cablear el mapa etapa→pose (sobre placeholders DOM/CSS con el mismo contrato; sustituir por sprites cuando existan).
- [x] Clic en personaje → detalle real (opinión/código/nota). Respetar `prefers-reduced-motion`.
- [x] Escenas de Dev Team (oficina) y Second Brain (biblioteca) (placeholders con el contrato).

**DoD:** la vista interactiva de Council refleja las etapas reales y el clic muestra contenido real ✅. _Sprites reales de PixelLab en **standby** (egress/MCP); el render usa placeholders con el mismo `SceneTheme`, así que sustituirlos es solo cambiar `assets`. Esto NO bloquea la parte funcional, que queda cerrada en la Fase 7._

---

## Fase 7 — Integración, seguridad y pulido

- [x] Repaso del modelo de amenazas (`07-security.md`): sin secretos en logs/URLs, validación de entradas, sandbox revisado. → `docs/specs/security-review.md`.
- [x] Suite de tests completa según `specs/test-plan.md`; cobertura de la lógica de orquestación. Cerrados los huecos **FR-5/TC-5** (caché) y **NFR-6/TC-6** (fallback). 72 tests verdes.
- [x] README de cada app actualizado con cómo arrancar y configurar (`projects/*/README.md`).
- [x] Revisar costes/operación (`08-costs.md`, `09-operations.md`) y dejar notas de despliegue (`start.sh`, NFR-9).
- [x] Verificación final contra los requisitos: cada FR/NFR/CON tiene implementación o queda anotado → `docs/specs/traceability.md`.

**DoD:** `test-plan.md` cubierto (los `Must` automatizables en verde; E2E con modelos reales y TC-S4 quedan como prueba manual por el bloqueo de egress); los tres modos funcionan end-to-end en chat; sin secretos expuestos; READMEs al día. _Vista interactiva: contrato + placeholders funcionan; sprites PixelLab en **standby** (ver Fase 6)._

---

## Notas de progreso

Usa esta sección como bitácora: fecha, fase, qué quedó hecho, qué bloqueó. Claude Code debe escribir aquí al cerrar cada sesión de trabajo.

- **2026-06-26 · Fase 0 — Arranque del repo y entorno · CERRADA.**
  - Entorno con `uv` (Python 3.11). `pyproject.toml` con deps core (FastAPI, uvicorn,
    httpx, python-dotenv) + grupo `dev` (pytest, pytest-asyncio). `langgraph` y
    `chromadb` declarados como extras `devteam`/`secondbrain` (no instalados hasta
    su fase, para no inflar el entorno de Fase 0/1). `uv.lock` commiteado.
  - Backend shell `app.py` (FastAPI) con `/health` y `/api/health` (contrato
    api-spec): devuelven 200 con `{status, profile, models:{cloud,gpu,local,anthropic}}`,
    solo booleanos, sin secretos. `shared/` es paquete del núcleo; `model_router.py`
    importa y lee el entorno; `shared/health.py` reporta destinos configurados.
  - `.env` creado desde `.env.example` con `MODEL_PROFILE=cloud_only` (gitignored).
    Estructura de backend por app en `projects/{council,dev-team,second-brain}/backend/`.
  - Tests: 6 verdes (`uv run pytest`) — salud (200, contrato, sin fugas de secretos),
    perfil activo y router rechaza prefijo desconocido. Backend verificado a mano:
    `uvicorn app:app` levanta y `/health` responde 200.
  - Sin ADR nuevo: ninguna decisión se desvió del SDD. La única elección propia
    (extras pesados diferidos por fase) es de empaquetado, no de arquitectura.
  - **Pendiente para Fase 1:** verificar contra mi cuenta de Ollama Cloud que los
    nombres de modelo del perfil `cloud_only` existen de verdad y ajustarlos si no.

- **2026-06-26 · Fase 1 — Núcleo común · DoD CUMPLIDO; 1 subtarea bloqueada.**
  - `call_model` refactorizado con `destination_for()` (helper de prefijo→destino) y
    cubierto por tests con `httpx.MockTransport` para los 4 destinos: enrutado a host
    correcto, nombre sin prefijo, Bearer en cloud, RuntimeError si falta `GPU_HOST`,
    ValueError en prefijo desconocido, y adaptación Anthropic (system separado +
    max_tokens). (TC-1, TC-2, FR-1, ADR-0003).
  - `shared/concurrency.py`: gestor global de modo único (`ConcurrencyManager` singleton).
    Un segundo modo mientras otro corre → `ModeBusyError` ("bloqueado"); context manager
    `run()` libera siempre. **Divergencia con SDD §12.4 (carriles paralelos) registrada
    en ADR-0008** y señalada para revisión del SDD.
  - `shared/sse.py`: `StageEmitter` reutilizable (cola async para StreamingResponse) con
    el contrato de etapas §13.2 (stage:start/done, agent:active/waiting, handoff,
    session:done, mode:locked) + `emit()` libre para los eventos concretos de api-spec.
    Hace cumplir el orden de etapas (emitir fuera de orden lanza ValueError).
  - Integridad de config: test parametrizado que valida que TODO model id de TODOS los
    perfiles tiene prefijo enrutable; `cloud_only` es 100% `cloud/`.
  - Tests: **30 verdes** (`uv run pytest`). DoD de Fase 1 cumplido (router, bloqueo de
    2º modo, SSE en orden).
  - **BLOQUEADO:** verificación de que los nombres de modelo del perfil existen en la
    cuenta de Ollama Cloud. Herramienta lista (`shared/verify_models.py`) y clave ya en
    `.env`, pero **la política de egress del entorno remoto bloquea `ollama.com` (403
    del proxy)**. No se puede sortear (instrucción del proxy). Resolver ejecutando la
    utilidad en local o añadiendo `ollama.com` al allowlist del entorno.

- **2026-06-26 · Fase 2 — Shell de frontend común · DoD CUMPLIDO.**
  - `frontend/` con Vite + React (build de producción verde, 38 módulos). Proxy de
    `/api` y `/health` al backend `:8000` en desarrollo.
  - Shell: `Sidebar` (Hub + 3 modos como carpetas colapsables con historial por modo),
    `Header` (toggle Chat/Interactiva + perfil activo), `ChatView`, `InteractiveView`
    (escena placeholder que refleja la etapa real; sprites PixelLab llegan en Fase 6),
    `StageProgress` (barra por ETAPAS, sin ETA).
  - Recoloreado total por contexto vía variables CSS con cross-fade ~250 ms (Hub índigo,
    Council teal, Dev Team coral, Second Brain púrpura).
  - Concurrencia en UI coherente con ADR-0008: un modo ocupado muestra punto pulsante
    y **bloquea los demás** (banner no bloqueante + botón deshabilitado), con barra por
    etapas en vivo. `prefers-reduced-motion` desactiva animaciones (NFR-INT-1).
  - Backend: `POST /api/demo/{mode}/run` (SSE) que ejerce el lock global + `StageEmitter`
    (etapas reales por modo), `GET /api/status`. 409 `mode_busy` si ocupado.
  - Verificación: build verde; smoke end-to-end con Playwright/Chromium (capturas de
    Hub, Council corriendo, Dev Team bloqueado, vista interactiva) + prueba de stack
    (council corriendo → devteam 409 → etapas en orden → lock liberado).
  - Tests backend: **34 verdes** (incluye `tests/test_demo_endpoint.py`).

- **2026-06-26 · Fase 3 — Council (vertical completa) · DoD CUMPLIDO.**
  - `shared/conversations.py`: persistencia JSON en `data/conversations/<id>.json`
    (FR-3, data-model.md) + endpoints comunes `POST/GET /api/conversations[/{id}]`.
  - `projects/council/backend/orchestrator.py`: tres etapas — opiniones en paralelo
    (`asyncio.gather`), revisión cruzada **anonimizada** (mapa modelo→anon-N aleatorio,
    el revisor no ve ids reales), cálculo del **más votado**, síntesis del chairman.
    Todo por `call_model`; modelos desde `model_config`. Emite eventos api-spec
    (`stage1_opinion`, `stage1_complete`, `stage2_review`, `stage3_final`, `model_error`)
    y el contrato de etapas (`stage:start/done`).
  - `projects/council/backend/router.py`: `POST /api/council/{cid}/query` (SSE) bajo el
    lock global (`council`); persiste la síntesis con `stage_data`. 409 si ocupado.
  - Frontend `CouncilChatView`: síntesis del chairman + pestañas de opiniones + panel
    de revisión anónima, consumiendo el SSE real; barra por etapas; manejo de
    `model_error`. Build de producción verde.
  - Tests: **45 verdes** — quorum (3 opiniones en paralelo; sigue si un agente falla),
    anonimización (sin fuga de ids en la revisión), el chairman recibe todas las
    opiniones + rankings, parseo de rankings, más votado, y endpoint SSE end-to-end
    con persistencia. Verificación visual del flujo completo con Playwright (modelos
    faked por el bloqueo de egress).

- **2026-06-26 · Diseño Claude Design (LLM Collective.html) aplicado al frontend.**
  - Importado del bundle exportado de Claude Design (la auth del MCP `DesignSync` no
    estaba disponible en remoto; el usuario adjuntó el HTML). Extraído el componente
    y assets del bundle datacore y re-implementado en React conservando el wiring real.
  - Tema claro/oscuro (variables CSS `@property`, cross-fade), acentos por modo,
    IBM Plex Mono local, fondo de partículas (canvas) reposo/working, sidebar con
    carpetas+historial, paneles contextuales (council revisión+consenso REAL; devteam
    pipeline; brain notas+túnel), composer por modo, toast no bloqueante (por etapas,
    sin ETA — regla CLAUDE.md, aunque el diseño mostraba ETA).
  - Doc 13 → v1.1 (§13.1-bis) y reparto de herramientas en CLAUDE.md. Build verde;
    45 tests backend. La vista interactiva pixel-art (escenas/personajes) sigue siendo
    de PixelLab en la Fase 6; este diseño cubre la UI del shell.

- **2026-06-26 · Fase 4 — Dev Team (vertical completa) · DoD CUMPLIDO.**
  - `projects/dev-team/backend/sandbox.py`: sandbox de ejecución (workdir efímero,
    validación de rutas anti-escape, RLIMIT_CPU/FSIZE + timeout, entorno sin secretos).
    Backend **subprocess** por no haber Docker en el entorno → **ADR-0009** (señala la
    diferencia con NFR-4; interfaz lista para Docker).
  - `pipeline.py`: grafo **LangGraph** architect→programmer→reviewer→tester con bucle
    de corrección (tester real ejecuta pytest; vuelve al programador si falla, tope
    `MAX_FIX_ITERATIONS`). Todo LLM por `call_model`; modelos de `model_config`. Emite
    eventos api-spec (role_start/role_output/tool_call/test_result/loop_back/delivery)
    + contrato de etapas.
  - `router.py`: `POST /api/devteam/{cid}/task` (SSE) bajo el lock global; persiste
    `stage_data` (iterations, roles, files, tests_passed). Cargado vía
    `shared/devteam_loader.py` (el guion de `dev-team` impide el import por puntos).
  - Frontend: `DevTeamView` real (plan, código, revisión, resultados de tests con
    badges OK/falla por iteración) + panel de pipeline animado por etapas.
  - Tests: **54 verdes** — sandbox rechaza escapes de ruta (TC-D4), corre pytest real,
    pipeline avanza, **loop_back** tras fallo y luego pasa, tope de iteraciones (FR-D4),
    endpoint SSE + persistencia. Verificación visual con Playwright (iter1 falla →
    iter2 OK), modelos faked por el bloqueo de egress.

- **2026-06-26 · Fase 5 — Second Brain (vertical completa) · DoD CUMPLIDO.**
  - `shared/model_router.embed_text/embed_texts` (vía /api/embeddings de Ollama).
  - `projects/second-brain/backend/`: `chunker.py` (troceo por headings con solape),
    `store.py` (Chroma + manifiesto mtime; persistente o efímero), `indexer.py`
    (build_plan/apply_plan con reindexado **incremental** por mtime y borrado de notas
    eliminadas), `retriever.py` (recuperación top_k + síntesis citando notas),
    `router.py` (index 202 + estado de job, query SSE bajo lock 'brain').
  - **Acceso solo por túnel** (FR-S5, ADR-0006): dependencia `require_tunnel`
    (loopback o token `SECONDBRAIN_TUNNEL_TOKEN`); acceso directo externo → 403.
  - Frontend `BrainView`: respuesta + **chips de citación** + panel de notas
    recuperadas con score + indicador de túnel. `api.runBrainQuery`.
  - Backend cargado vía `shared/backend_loader.py` (generaliza el loader; `dev-team` y
    `second-brain` llevan guion). 
  - Tests: **63 verdes** — chunking, store, indexado + incremental (FR-S2), la
    respuesta cita notas reales (FR-S3/S4), túnel rechaza acceso directo (TC-S5),
    endpoint index+query end-to-end. Verificación visual con Playwright (vault
    sintético; sync.md recuperado y citado). Embeddings/chairman faked por egress.

- **2026-06-26 · Fase 6 — Vista interactiva · contrato + escenas (placeholders).**
  - `frontend/src/scenes.js`: implementaciones del contrato `SceneTheme` (§13.4) para
    los tres modos (Council mesa redonda, Dev Team oficina, Second Brain biblioteca):
    `layout`, `poseFor` (pose desde la etapa/datos REALES) y `detailFor` (contenido real).
  - `InteractiveScene.jsx`: render con placeholders DOM/CSS posicionados por el tema;
    toggle **Chat / Interactiva** en la cabecera; clic en personaje → detalle real
    (opinión del caballero / síntesis del rey / código del rol / notas). Respeta
    `prefers-reduced-motion` (NFR-INT-1). Verificado: clic en el Rey muestra la
    síntesis real del chairman.
  - **BLOQUEADO:** generar los sprites pixel-art con PixelLab — el MCP no está
    conectado y `api.pixellab.ai` está bloqueado por egress (403). Como prevé el SDD
    (§13.5), se usan placeholders con el mismo contrato; sustituirlos por los sprites
    es solo cambiar `assets`. 63 tests backend siguen verdes; build de frontend verde.

- **2026-06-28 · Fase 7 — Integración, seguridad y pulido · CERRADA. Interactiva en STANDBY.**
  - **Decisión de entrega:** aparcar la parte pixel-art (sprites PixelLab, bloqueada por
    egress/MCP) y terminar la parte funcional. La vista interactiva sigue operativa con
    placeholders sobre el contrato `SceneTheme`; cuando haya MCP, sustituir es cambiar
    `assets`. No bloquea nada de lo funcional.
  - **FR-5 (caché de respuestas) implementada** en `shared/model_router.py`: respuestas
    idénticas (model + messages + opts) se sirven de memoria (`_cache`, `_cache_key`,
    `clear_cache`, `cache_stats`); desactivable con `MODEL_CACHE=0`; `use_cache=False`
    fuerza llamada fresca. Cubre la palanca de ahorro de `08-costs` y `cache_hit` de
    `09-operations`.
  - **NFR-6 (fallback configurable) implementado**: `model_config.FALLBACKS`/`fallback_for`
    (por perfil) + reintento en `call_model` cuando el proveedor falla (5xx/conexión) o
    el modelo no existe (404). 429 (queue_full) NO cambia de modelo (backoff, runbook).
    Sin ciclos infinitos (`_tried`). En `cloud_plus_gpu`, la GPU caída cae a cloud.
  - **Validación de entradas (seguridad/DoS):** `content` 1–16 000 chars en los tres
    endpoints de consulta; `max_iterations` acotado 1–20 (devteam); `top_k` 1–50 (brain).
  - **Repaso de seguridad** completo en `docs/specs/security-review.md`: sin secretos en
    logs/URLs (claves solo en headers; `verify_models` no imprime la clave; `/health` solo
    booleanos), sandbox con env limpio + rlimits + anti-escape de rutas, túnel del brain.
  - **READMEs** de las tres apps reescritos (arranque, configuración por perfil, API, tests).
    **`start.sh`** creado (NFR-9, referenciado en `09-operations` pero ausente).
  - **Trazabilidad final** en `docs/specs/traceability.md`: cada FR/NFR/CON con
    implementación + prueba, o anotado (FR-S6 `Could` no implementado; NFR-1/NFR-3/TC-S4
    como prueba manual por el bloqueo de egress).
  - **Tests: 72 verdes** (`uv run pytest`), +9 nuevos (caché, fallback, validación). App
    arranca; fallback y caché verificados en import. Egress a `ollama.com` sigue bloqueado:
    corridas con modelos reales siguen pendientes de ejecutar en local (no es código).

---

## 🔖 PUNTO DE RETOMA (2026-06-28)

**Dónde retomar:** Fases 0–7 cerradas. La **parte funcional está terminada**. Lo único
pendiente NO es código, sino desbloqueos de entorno: (1) corridas con modelos reales
(egress `ollama.com`) y (2) los **sprites de PixelLab**, que quedan en **STANDBY** por
decisión de entrega. Retomar la parte interactiva pixel-art solo cuando el MCP de
PixelLab esté disponible (Claude Desktop/local).

### Estado por fase
- **0–5 ✅** núcleo + las 3 verticales (Council, Dev Team, Second Brain) end-to-end.
- **6 ✅ funcional / ⏸️ sprites en STANDBY** — vista interactiva con contrato `SceneTheme`
  + placeholders operativos; los sprites de PixelLab se aparcan (bloqueados, ver abajo).
- **7 ✅ CERRADA** — caché (FR-5), fallback (NFR-6), validación de entradas, repaso de
  seguridad (`docs/specs/security-review.md`), READMEs de apps, `start.sh`, trazabilidad
  (`docs/specs/traceability.md`). 72 tests verdes.

### Qué falta (no es código)
1. Ejecutar `uv run python -m shared.verify_models` y una corrida real de cada modo en un
   entorno con egress a `ollama.com` (o añadirlo al allowlist).
2. Generar e integrar los sprites de PixelLab (STANDBY) — ver `ASSETS.md`.

### Cómo arrancar el proyecto
```bash
uv sync --extra devteam --extra secondbrain   # backend completo
uv run pytest                                  # 63 tests verdes
uv run uvicorn app:app --reload                # backend :8000
cd frontend && npm install && npm run dev      # frontend :5173 (proxy a :8000)
```

### Arquitectura ya construida (para orientarse)
- `shared/`: `model_router.py` (call_model + embed_*), `concurrency.py` (lock modo
  único), `sse.py` (StageEmitter), `conversations.py`, `model_config.py`,
  `backend_loader.py` (carga paquetes con guion), `health.py`.
- `app.py`: monta routers de council + devteam + secondbrain + demo/health/status.
- `projects/council|dev-team|second-brain/backend/`: orquestadores + routers.
- `frontend/src/`: `App.jsx` (shell con diseño Claude Design), `scenes.js` +
  `InteractiveScene.jsx` (Fase 6), `api.js`, `ParticleField.jsx`, `Icons.jsx`.
- ADRs nuevos: **0008** (concurrencia modo único, diverge de SDD §12.4),
  **0009** (sandbox subprocess en vez de Docker).

### ⛔ Bloqueos del ENTORNO (no del código) — resolver en local o con allowlist
1. **`ollama.com` (403 egress):** no se pueden hacer corridas reales de modelos ni
   `uv run python -m shared.verify_models`. Verificado todo con modelos *faked*.
   La clave de Ollama ya está en `.env` (local, gitignored).
2. **`api.pixellab.ai` (403 egress) + MCP de PixelLab no conectado:** no se pueden
   generar los sprites. Hacerlo en Claude Desktop/Code local (ver `ASSETS.md §3`) y
   colocar en `assets/scenes/council-round-table/`; luego apuntar `assets` en
   `frontend/src/scenes.js`.

### Fase 7 — tareas pendientes (lo que toca)
- [ ] Repaso del modelo de amenazas (`07-security.md`): sin secretos en logs/URLs,
      validación de entradas, sandbox revisado.
- [ ] Suite completa según `specs/test-plan.md`; cobertura de orquestación.
- [ ] README de cada app (`projects/*/README.md`) con cómo arrancar/configurar.
- [ ] Revisar costes/operación (`08-costs.md`, `09-operations.md`) + notas de despliegue.
- [ ] Verificación final FR/NFR/CON: cada requisito con implementación o anotado.
