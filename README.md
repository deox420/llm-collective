# LLM Collective

> Un núcleo de orquestación, tres formas de hacer pensar a varios modelos a la vez.

`llm-collective` toma la idea de [`karpathy/llm-council`](https://github.com/karpathy/llm-council) —preguntar a un consejo de LLMs y sintetizar la mejor respuesta— y la generaliza en una plataforma local-first que sirve para tres cosas distintas, sobre el mismo esqueleto.

| Proyecto | Idea en una frase |
|----------|-------------------|
| [**Council**](#-council) | Varios modelos opinan, se critican entre sí, y un presidente sintetiza. |
| [**Dev Team**](#-dev-team) | Un equipo de roles (arquitecto, programador, revisor, tester) construye software de verdad. |
| [**Second Brain**](#-second-brain) | Un LLM que responde desde tus notas de Obsidian, no desde su memoria. |

Los tres comparten frontend (estilo Karpathy), backend FastAPI y una única capa de invocación de modelos. Lo que cambia es **cómo se organizan los agentes**.

---

## 📦 Estado del repositorio

**Ya hay un push principal de la implementación.** El código vive en la rama
`claude/llm-collective-phase-0-2947fb`, con un **Pull Request abierto (#1)** hacia `main`.

- **Hecho y pusheado:** Fases 0–6 — núcleo común, las tres verticales (Council, Dev
  Team, Second Brain) end-to-end, el shell con el diseño de Claude Design y la vista
  interactiva (contrato `SceneTheme` con placeholders). **63 tests backend en verde.**
- **Pendiente:** Fase 7 (integración, seguridad y pulido) y dos cosas que dependen
  del entorno (ver `IMPLEMENTATION_PLAN.md → 🔖 PUNTO DE RETOMA`):
  - corridas reales contra Ollama Cloud (egress a `ollama.com` bloqueado en el entorno de build);
  - sprites pixel-art de PixelLab (egress a `api.pixellab.ai` bloqueado / MCP no conectado).

El detalle fase a fase está en [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (bitácora).

---

## Arquitectura común

El reparto de cómputo por defecto:

- **3 agentes en Ollama Cloud** (plan Pro: 3 modelos concurrentes, 20 $/mes).
- **1 chairman en una GPU alquilada por horas** (Runpod / Vast.ai) corriendo Ollama.

Todo pasa por una función router, `call_model`, que enruta cada llamada según un prefijo (`cloud/`, `gpu/`, `local/`, `anthropic/`). Cambiar dónde corre un modelo es cambiar un string.

```python
COUNCIL_MODELS = ["cloud/qwen3:32b", "cloud/deepseek-r1:32b", "cloud/llama3.3:70b"]
CHAIRMAN_MODEL = "gpu/llama3.3:70b"
```

Diagrama completo y decisiones de diseño en [`docs/SDD.md`](docs/SDD.md). Diagramas en [`docs/diagrams/`](docs/diagrams/).

---

## 🏛 Council

**Patrón:** ensemble democrático + peer review.

1. La pregunta va a los 3 agentes en paralelo.
2. Cada uno revisa y rankea las respuestas de los otros (anonimizadas, para que no haya favoritismos).
3. El chairman compila todo en una respuesta final.

Útil para preguntas difíciles donde ver varias perspectivas y sus críticas cruzadas vale más que una sola respuesta. Aviso: que cuatro modelos coincidan no significa que tengan razón.

```bash
cd projects/council && ./start.sh
```

---

## 🛠 Dev Team

**Patrón:** pipeline jerárquico con roles y herramientas reales.

```
Arquitecto → Programador → Revisor → Tester
                  ▲                      │
                  └──────── si falla ────┘
```

Cada rol es un modelo con su propio system prompt. A diferencia del council, aquí algunos agentes **ejecutan acciones** (escriben ficheros, corren tests). El arquitecto/líder va en la GPU potente; programador y revisor en cloud.

- Se apoya en **LangGraph / CrewAI** para el grafo de roles y el tool-calling.
- Todo agente con shell corre en **sandbox Docker**. Nunca en tu máquina.
- Bucle de corrección con tope de iteraciones.

```bash
cd projects/dev-team && ./start.sh
```

---

## 🧠 Second Brain

**Patrón:** RAG sobre un vault de Obsidian.

- **Indexado** (offline): tus notas `.md` → embeddings locales (`nomic-embed`) → base vectorial (Chroma/LanceDB).
- **Consulta** (online): recupera las notas relevantes y el chairman responde citándolas.
- **Acceso remoto** desde el móvil vía **túnel seguro** (Tailscale / Cloudflare), sin abrir puertos.

Privacidad: si el chairman y la base vectorial viven en la misma GPU, tus notas no salen de ahí. Conector recomendado: **MCP** con un servidor de Obsidian.

```bash
cd projects/second-brain && ./start.sh
```

---

## Puesta en marcha

### Requisitos

- Python 3.10+ y [uv](https://docs.astral.sh/uv/)
- Node.js + npm
- Cuenta de [Ollama Cloud](https://ollama.com) (plan Pro recomendado)
- Una GPU alquilada (Runpod/Vast.ai) para el chairman — opcional al empezar

### Configuración

```bash
git clone <este-repo>
cd llm-collective
cp .env.example .env     # rellena tus claves y hosts
uv sync                  # backend: deps core + grupo dev
# El frontend se crea en la Fase 2: cd frontend && npm install
```

Variables en `.env`:

```env
MODEL_PROFILE=cloud_only    # empieza aquí: todo en Ollama Cloud, sin GPU
OLLAMA_CLOUD_HOST=https://ollama.com
OLLAMA_CLOUD_API_KEY=...
GPU_HOST=http://<tailscale-ip>:11434
ANTHROPIC_API_KEY=          # opcional
```

### Desarrollo (arranque del backend)

```bash
uv run uvicorn app:app --reload     # backend en http://127.0.0.1:8000
curl http://127.0.0.1:8000/health   # -> {"status":"ok", ...}
uv run pytest                        # tests del backend
```

El endpoint `/api/health` refleja qué destinos de modelo están configurados
(`cloud`, `gpu`, `local`, `anthropic`) sin exponer claves ni hosts. Extras por
vertical: `uv sync --extra devteam` (Fase 4) · `uv sync --extra secondbrain` (Fase 5).

---

## Estructura del repo

```
llm-collective/
├── docs/
│   ├── SDD.md                  # índice maestro del SDD
│   ├── 00-vision.md … 11-glossary.md   # núcleo, subsistemas, transversal
│   ├── adr/                    # 6 architecture decision records
│   ├── specs/                  # API, modelo de datos, plan de pruebas
│   └── diagrams/               # C4 (contexto/contenedor/componente) + secuencia + SVG
├── prompts/
│   └── claude-design-prompt.md # prompt para generar la web con Claude Design
├── shared/
│   └── model_router.py         # call_model: la capa común
├── projects/
│   ├── council/
│   ├── dev-team/
│   └── second-brain/
└── README.md
```

El SDD es un cuerpo de documentación multi-archivo, no un único fichero. Empieza por [`docs/SDD.md`](docs/SDD.md), que es el índice maestro.

---

## Construir el proyecto con Claude Code

El repo está preparado para que **Claude Code** lo implemente de principio a fin:

1. Abre el repo con Claude Code. Leerá [`CLAUDE.md`](CLAUDE.md) automáticamente.
2. Copia `.env.example` a `.env` y rellena tus claves (Ollama Cloud, GPU, PixelLab…).
3. (Opcional, para el pixel-art) registra el MCP de PixelLab:
   ```bash
   claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer TU_API_KEY"
   ```
   Detalles en [`ASSETS.md`](ASSETS.md).
4. Pídele que siga [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) fase por fase. Cada fase tiene su *Definition of Done*.

La fuente de verdad es el SDD ([`docs/SDD.md`](docs/SDD.md)); el plan y `CLAUDE.md` solo lo operativizan.

---

## Estado y filosofía

Inspirado en el "vibe code alert" de Karpathy: esto es una base para construir y trastear, no un producto soportado. El código es efímero; pídele a tu LLM que lo cambie como quieras.

## Créditos

Concepto original del council: [Andrej Karpathy](https://github.com/karpathy/llm-council). Esta unificación y extensión añade el dev-team, el second-brain y la capa de orquestación común.

## Licencia

MIT (ver `LICENSE`).
