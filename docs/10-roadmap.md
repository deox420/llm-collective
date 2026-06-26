# 10 · Roadmap

Orden por dificultad creciente y valor.

## Fase 1 — Council hibrido
Refactor de llm-council con la capa `call_model` y el reparto cloud + GPU. ~60% del codigo ya existe en el proyecto original. Entrega temprana de valor y valida el nucleo.

Hitos: router funcionando (FR-1), paralelismo etapa 1/2 (NFR-2), streaming SSE (FR-2), caso TC-C4 en verde.

## Fase 2 — Second Brain
Pipeline RAG + tunel. El mas util en el dia a dia. Complejidad media: lo dificil es el pipeline de indexado/recuperacion, no el LLM.

Hitos: indexado incremental (FR-S2), retrieval + citas (FR-S3/S4), acceso remoto por tunel (FR-S5), TC-S1..S5 en verde.

## Fase 3 — Dev Team
Integracion LangGraph/CrewAI + sandbox. El mas ambicioso y arriesgado: agentes que ejecutan acciones reales.

Hitos: grafo con bucle (FR-D2), sandbox aislado (NFR-4), tope de iteraciones (FR-D4), TC-D1..D4 en verde.

## Transversal (continuo)
- Caché de respuestas (FR-5).
- Fallback de modelos (NFR-6).
- Apagado automatico de GPU (NFR-5).
- Diseño web con Claude Design (ver prompts/).
