# CLAUDE.md — Guía para Claude Code

Este archivo lo lee Claude Code automáticamente. Es el punto de entrada para implementar **LLM Collective** de principio a fin. Léelo entero antes de escribir código.

---

## Qué es este proyecto

Plataforma **local-first** que orquesta varios LLMs sobre un núcleo común, en tres aplicaciones que comparten frontend, backend y capa de modelos:

- **Council** — varios modelos opinan, se critican entre sí (anonimizados) y un *chairman* sintetiza.
- **Dev Team** — pipeline de roles (arquitecto → programador → revisor → tester) con herramientas reales y sandbox.
- **Second Brain** — RAG sobre un vault de Obsidian, accesible en remoto por túnel seguro.

La especificación completa está en `docs/`. **El SDD manda**: si este archivo y el SDD se contradicen, gana el SDD y lo señalas.

## Documentos que debes leer antes de implementar

Por orden:
1. `docs/SDD.md` — índice maestro. Empieza aquí.
2. `docs/00-vision.md`, `docs/01-requirements.md` — qué se construye y los IDs de requisitos (FR/NFR/CON) que el código debe satisfacer.
3. `docs/02-architecture.md` — capas, `call_model`, concurrencia.
4. `docs/04-council.md`, `05-dev-team.md`, `06-second-brain.md` — cada subsistema.
5. `docs/specs/api-spec.md`, `specs/data-model.md`, `specs/test-plan.md` — contratos concretos.
6. `docs/07-security.md` — modelo de amenazas; respétalo en cada endpoint.
7. `docs/12-frontend.md`, `docs/13-interactive-scenes.md` — UX, las dos vistas (chat / interactiva) y escenas pixel-art.
8. `docs/adr/` — decisiones tomadas. **No las reviertas sin registrar un nuevo ADR.**

## Cómo trabajar (flujo esperado)

1. Lee `IMPLEMENTATION_PLAN.md` (en la raíz). Es el plan por fases con criterios de "hecho".
2. Trabaja **una fase a la vez, en orden**. No empieces una fase sin cerrar la anterior.
3. Al terminar cada tarea: marca su casilla en `IMPLEMENTATION_PLAN.md`, haz commit con un mensaje claro.
4. Cada fase tiene un **Definition of Done**. No la des por cerrada hasta cumplirlo (incluye tests pasando).
5. Si una decisión no está en el SDD, tomas la más simple que cumpla los requisitos, la documentas en un ADR nuevo (`docs/adr/NNNN-...md`) y sigues.

## Principios de implementación (no negociables)

- **Todo modelo se invoca por `call_model`** (`shared/model_router.py`). Nunca llames a un proveedor directamente desde la lógica de una app. Enrutado por prefijo: `cloud/`, `gpu/`, `local/`, `anthropic/`.
- **Qué modelo va a cada rol se lee de `shared/model_config.py`** (perfiles seleccionables por `MODEL_PROFILE`). Nunca hardcodees nombres de modelo en la lógica de una app; impórtalos de ahí. El perfil por defecto es `cloud_only` (todo en Ollama Cloud), para poder construir y probar sin GPU. Físico vs alquiler se decide después cambiando de perfil, sin tocar código.
- **Concurrencia: un modo a la vez.** Mientras un modo trabaja, los otros están bloqueados (FR de concurrencia en `01-requirements.md` y `12-frontend.md`). El estado de "ocupado" es global.
- **Progreso por ETAPAS, nunca ETA por tiempo.** Council: opinions → review → synthesis. Dev Team: architect → programmer → reviewer → tester. Second Brain: retrieval → synthesis.
- **Local-first y privacidad:** nada de claves ni datos del vault en logs, URLs o parámetros de query. Acceso remoto solo por túnel (ADR-0006), nunca puerto abierto.
- **SSE para el progreso:** el backend emite eventos de etapa; el frontend (chat y escena) los consume. Contrato en `docs/13-interactive-scenes.md` §13.2 y `specs/api-spec.md`.
- **La escena interactiva refleja el estado real.** Nunca animación falsa: cada pose viene de un evento real de etapa/agente.

## Stack

- **Backend:** Python 3.11+, FastAPI, httpx, SSE. Gestor de paquetes: `uv` si está disponible, si no `pip` + venv.
- **Frontend:** React (Vite), un único build que sirve las tres apps con shell común. Sin dependencias pesadas innecesarias. Sin `localStorage`/`sessionStorage` en artefactos de escena (estado en memoria).
- **Vector store (Second Brain):** Chroma o LanceDB (ver `data-model.md`). Embeddings locales con `nomic-embed-text` vía Ollama.
- **Orquestación Dev Team:** LangGraph (ADR-0005).
- **Pixel-art:** assets de PixelLab vía su MCP (ver `ASSETS.md`). Hasta tenerlos, placeholders de canvas con el mismo contrato.

## Estructura del repo

```
docs/                 # SDD completo (la fuente de verdad)
prompts/              # prompts para Claude Design y PixelLab
shared/               # núcleo común (model_router.py, y lo que añadas)
projects/
  council/            # app Council (backend + frontend)
  dev-team/           # app Dev Team
  second-brain/       # app Second Brain
frontend/             # shell común React (lo creas en Fase 2)
assets/scenes/        # sprites/fondos de PixelLab (lo llenas en Fase 6)
IMPLEMENTATION_PLAN.md # plan por fases — tu hoja de ruta
ASSETS.md             # cómo generar el pixel-art con PixelLab/MCP
```

## Comandos (defínelos de verdad al crear cada parte)

Cuando montes el backend y el frontend, crea estos scripts y mantenlos vivos:

```bash
# backend (raíz del repo)
uv sync                                 # instala deps (core + grupo dev)
uv run uvicorn app:app --reload         # levanta el backend (/health, /api/health)
uv run pytest                           # tests del backend

# frontend (se crea en Fase 2)
cd frontend && npm install && npm run dev   # desarrollo
npm run build                               # build de producción
```

Extras pesados por vertical (no se instalan hasta su fase):
`uv sync --extra devteam` (Fase 4, LangGraph) · `uv sync --extra secondbrain` (Fase 5, Chroma).

Si cambias cómo se arranca algo, actualiza esta sección y el README.

## Reglas de calidad

- Tests para la lógica de orquestación (council quorum, pipeline dev-team, retrieval del brain). Ver `specs/test-plan.md`.
- Type hints en Python; componentes funcionales en React.
- Commits pequeños y descriptivos. Una fase puede ser varios commits.
- No dejes TODOs silenciosos: si algo queda pendiente, va a `IMPLEMENTATION_PLAN.md`.

## Qué NO hacer

- No expongas Ollama ni el backend a internet por puerto abierto.
- No metas secretos en el repo (usa `.env`, ya está en `.gitignore`).
- No rompas la regla de `call_model`.
- No conviertas el progreso por etapas en un ETA por tiempo.
- No reviertas un ADR sin escribir uno nuevo que lo supere.
