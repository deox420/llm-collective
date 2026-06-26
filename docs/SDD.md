# Software Design Document — LLM Collective

**Versión:** 2.2 · **Estado:** Borrador para revisión · **Fecha:** 2026-06-26

Este SDD no es un único documento, sino un cuerpo de documentación de ingeniería organizado por preocupación. Empieza por aquí.

---

## Cómo leer este SDD| Si eres… | Empieza por |
|----------|-------------|
| Nuevo en el proyecto | [00 · Visión](00-vision.md) → [Diagrama C4 contexto](diagrams/c4-context.md) |
| Arquitecto / revisor técnico | [02 · Arquitectura](02-architecture.md) → [ADRs](adr/) |
| Implementando el backend | [Spec API](specs/api-spec.md) → [Spec modelo de datos](specs/data-model.md) |
| Implementando un subsistema | [04 Council](04-council.md) / [05 Dev Team](05-dev-team.md) / [06 Second Brain](06-second-brain.md) |
| Encargado de seguridad | [07 · Seguridad y modelo de amenazas](07-security.md) |
| Encargado de QA | [Spec de pruebas](specs/test-plan.md) |
| Decidiendo presupuesto | [08 · Costes](08-costs.md) |
| Diseñando la interfaz | [12 · Frontend](12-frontend.md) → [prompt Claude Design](../prompts/claude-design-prompt.md) |
| Diseñando la vista interactiva | [13 · Escenas interactivas](13-interactive-scenes.md) → [ADR-0007 PixelLab](adr/0007-pixellab-assets.md) → [prompts de escena](../prompts/scenes/) |

---

## Índice de documentos

### Núcleo
- [00 · Visión y alcance](00-vision.md)
- [01 · Requisitos](01-requirements.md) — funcionales y no funcionales, con IDs trazables
- [02 · Arquitectura](02-architecture.md) — capas, `call_model`, concurrencia
- [03 · Vistas C4 y diagramas](03-diagrams.md) — índice visual

### Subsistemas
- [04 · Council](04-council.md)
- [05 · Dev Team](05-dev-team.md)
- [06 · Second Brain](06-second-brain.md)

### Transversal
- [07 · Seguridad y modelo de amenazas](07-security.md)
- [08 · Costes y dimensionamiento](08-costs.md)
- [09 · Despliegue y operación](09-operations.md)
- [10 · Roadmap](10-roadmap.md)
- [11 · Glosario](11-glossary.md)
- [12 · Frontend y UX](12-frontend.md) — navegación, paletas, fondo animado, concurrencia en la UI
- [13 · Vista interactiva y escenarios](13-interactive-scenes.md) — escenas pixel-art temáticas, contrato de tema, pipeline PixelLab
- [14 · SDD de Escenas Interactivas](14-scenes-sdd.md) — **rehecho v2**: movimiento real de personajes, coreografía por eventos, arte detallado, contrato `SceneTheme v2`

### Especificaciones técnicas (`specs/`)
- [API REST + SSE](specs/api-spec.md)
- [Modelo de datos](specs/data-model.md)
- [Plan de pruebas](specs/test-plan.md)
- [Trazabilidad de requisitos](specs/traceability.md) — cada FR/NFR/CON → implementación + prueba (Fase 7)

### Decisiones de arquitectura (`adr/`)
- [ADR-0001 · Ollama Cloud en vez de OpenRouter](adr/0001-ollama-cloud-vs-openrouter.md)
- [ADR-0002 · Chairman en GPU alquilada](adr/0002-chairman-on-rented-gpu.md)
- [ADR-0003 · `call_model` como capa única de enrutado](adr/0003-call-model-router.md)
- [ADR-0004 · RAG en vez de fine-tuning para el Second Brain](adr/0004-rag-vs-finetuning.md)
- [ADR-0005 · LangGraph/CrewAI para el Dev Team](adr/0005-langgraph-for-devteam.md)
- [ADR-0006 · Acceso remoto vía túnel, no puerto abierto](adr/0006-tunnel-not-open-port.md)
- [ADR-0007 · PixelLab como pipeline de assets pixel-art](adr/0007-pixellab-assets.md)
- [ADR-0008 · Concurrencia: un solo modo activo a la vez (lock global)](adr/0008-concurrencia-modo-unico-global.md)
- [ADR-0009 · Sandbox del Dev Team: subprocess como backend por defecto](adr/0009-sandbox-subprocess-fallback.md)
- [ADR-0010 · Fallback y caché de respuestas en `call_model`](adr/0010-fallback-y-cache-en-call-model.md)
- [ADR-0011 · Sistema de coreografía de escena dirigido por eventos](adr/0011-sistema-de-coreografia-de-escena.md)

### Diagramas (`diagrams/`)
- C4: [contexto](diagrams/c4-context.md), [contenedores](diagrams/c4-container.md), [componentes](diagrams/c4-component.md)
- Secuencia: [council](diagrams/seq-council.md), [dev-team](diagrams/seq-devteam.md), [second-brain](diagrams/seq-secondbrain.md)
- SVG de arquitectura: `01-council.svg`, `02-dev-team.svg`, `03-second-brain.svg`

---

## Resumen ejecutivo

`llm-collective` orquesta varios LLMs heterogéneos sobre un núcleo común para tres aplicaciones: **Council** (ensemble + peer review), **Dev Team** (pipeline de roles con herramientas) y **Second Brain** (RAG sobre Obsidian). Reparto base: **3 agentes en Ollama Cloud (Pro)** + **1 chairman en GPU alquilada por horas**. La pieza que une todo es `call_model`, un router que abstrae dónde corre cada modelo.

## Para implementar (Claude Code)

Estos archivos en la raíz del repo guían la construcción:

- [`CLAUDE.md`](../CLAUDE.md) — instrucciones que Claude Code lee al abrir el repo: principios, stack, qué no hacer.
- [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) — plan por fases (0→7) con checklists y *Definition of Done*.
- [`ASSETS.md`](../ASSETS.md) — generar el pixel-art con PixelLab (config MCP + prompts).
- [`.mcp.json`](../.mcp.json) — registro del MCP de PixelLab (usa `PIXELLAB_API_KEY` del entorno).
- [`prototypes/`](../prototypes/) — prototipo de la escena de Council (placeholder, referencia).

## Control de versiones del documento

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2026-06-26 | SDD inicial monolítico |
| 2.0 | 2026-06-26 | Reescritura multi-archivo: requisitos trazables, ADRs, specs de API/datos/pruebas, modelo de amenazas, costes, C4 y secuencia |
| 2.1 | 2026-06-26 | Vista interactiva: escenarios temáticos pixel-art (doc 13), pipeline PixelLab (ADR-0007), prompts de escena para Claude Design |
| 2.2 | 2026-06-26 | Listo para Claude Code: CLAUDE.md, plan de implementación por fases, ASSETS.md + MCP de PixelLab, prototipo de Council |
