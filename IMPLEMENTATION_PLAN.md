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
- [ ] **(Bloqueado)** Verificar que los modelos del perfil `cloud_only` existen en la cuenta de Ollama Cloud (`uv run python -m shared.verify_models`) y ajustar `model_config.py` si no. Requiere `OLLAMA_CLOUD_API_KEY` en `.env`.

**DoD:** tests del router pasan; un test demuestra que iniciar un segundo modo mientras otro corre devuelve "bloqueado"; los eventos SSE se emiten en orden de etapa.

---

## Fase 2 — Shell de frontend común

- [ ] Crear `frontend/` con Vite + React.
- [ ] Sidebar con los tres modos como carpetas colapsables + Hub, con historial de conversación por modo (`12-frontend.md`).
- [ ] Recoloreado de **toda la pestaña** según el acento del modo (Hub indigo, Council teal, Dev Team coral/amber, Second Brain púrpura) con cross-fade 200–300 ms.
- [ ] Indicador de modo ocupado: punto pulsante + bloqueo de los otros modos con mensaje no-bloqueante y **barra de progreso por etapas**.
- [ ] Toggle de las dos vistas (Chat / Interactiva) en la cabecera.
- [ ] Cliente SSE que consume los eventos de etapa del backend.

**DoD:** se navega entre los tres modos, el color tiñe toda la UI, y un modo "ocupado" simulado bloquea los otros con barra por etapas.

---

## Fase 3 — Council (vertical completa)

- [ ] Backend: orquestar N modelos vía `call_model`, recoger opiniones en paralelo (FR Council).
- [ ] Revisión cruzada anonimizada (A/B/C) y cálculo del más votado (`04-council.md`).
- [ ] Síntesis por el chairman; emisión de etapas opinions → review → synthesis por SSE.
- [ ] Frontend vista Chat: respuesta del chairman + pestañas de opiniones + panel de revisión.
- [ ] Tests: quorum, anonimización, que el chairman recibe todas las opiniones.

**DoD:** una pregunta real recorre las tres etapas y devuelve síntesis + opiniones; tests verdes; vista chat funcional.

---

## Fase 4 — Dev Team (vertical completa)

- [ ] Backend: pipeline LangGraph architect → programmer → reviewer → tester (ADR-0005, `05-dev-team.md`).
- [ ] Herramientas reales con **sandbox** para ejecutar/probar código de forma aislada (`07-security.md`).
- [ ] Bucle de retorno tester→programmer cuando fallan los tests.
- [ ] Emisión de etapas por SSE; frontend vista Chat con el código en streaming.
- [ ] Tests: el pipeline avanza, el retorno funciona, el sandbox contiene la ejecución.

**DoD:** una tarea de programación produce código probado por el pipeline; el sandbox impide efectos fuera de él; tests verdes.

---

## Fase 5 — Second Brain (vertical completa)

- [ ] Ingesta del vault Obsidian: trocear, generar embeddings locales (`nomic-embed-text`) y guardarlos en el vector store (`06-second-brain.md`, `data-model.md`).
- [ ] Recuperación + síntesis con citas a las notas fuente; etapas retrieval → synthesis por SSE.
- [ ] Acceso remoto por **túnel** (Tailscale/Cloudflare), nunca puerto abierto (ADR-0006, NFR de seguridad).
- [ ] Frontend vista Chat con chips de citación y notas recuperadas.
- [ ] Tests: la recuperación trae las notas correctas; las respuestas citan fuentes reales.

**DoD:** una pregunta sobre el vault responde citando notas reales; el acceso remoto funciona solo por túnel; tests verdes.

---

## Fase 6 — Vista interactiva + assets PixelLab

- [ ] Implementar el contrato `SceneTheme` (`13-interactive-scenes.md` §13.4) en el frontend.
- [ ] Generar los assets de **Council** (mesa redonda) con PixelLab vía MCP siguiendo `ASSETS.md`.
- [ ] Cablear los sprites al mapa etapa→pose; reemplazar los placeholders de canvas.
- [ ] Clic en personaje → detalle real (opinión/código/nota). Respetar `prefers-reduced-motion`.
- [ ] (Si hay tiempo) escenas de Dev Team (oficina) y Second Brain (biblioteca).

**DoD:** la vista interactiva de Council usa sprites reales de PixelLab y refleja las etapas reales; el clic muestra contenido real.

---

## Fase 7 — Integración, seguridad y pulido

- [ ] Repaso del modelo de amenazas (`07-security.md`): sin secretos en logs/URLs, validación de entradas, sandbox revisado.
- [ ] Suite de tests completa según `specs/test-plan.md`; cobertura de la lógica de orquestación.
- [ ] README de cada app actualizado con cómo arrancar y configurar.
- [ ] Revisar costes/operación (`08-costs.md`, `09-operations.md`) y dejar notas de despliegue.
- [ ] Verificación final contra los requisitos: cada FR/NFR/CON tiene implementación o queda anotado.

**DoD:** todo el `test-plan.md` pasa; los tres modos funcionan end-to-end en chat e interactivo; sin secretos expuestos; READMEs al día.

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
    cuenta de Ollama Cloud. Herramienta lista (`shared/verify_models.py`) pero requiere
    `OLLAMA_CLOUD_API_KEY` en `.env`. **Falta la clave del usuario.**
