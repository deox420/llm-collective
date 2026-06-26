# ADR-0005 · LangGraph/CrewAI para el Dev Team

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
El Dev Team es un grafo de roles con bucle de corrección y herramientas reales (ficheros, shell, tests). Construirlo a mano implica reimplementar gestión de estado, tool-calling y reintentos.

## Decisión
Apoyar la lógica de agentes en un framework existente (**LangGraph** o **CrewAI**) en vez de un grafo casero.

## Justificación
- Ambos implementan roles, grafos de estado, bucles y tool-calling probados.
- Se conectan igual a Ollama (cloud/GPU/local) que a Anthropic, compatible con `call_model`.
- Reduce superficie de bugs en la parte más arriesgada del proyecto.

## Consecuencias
- **Positivas:** menos código propio, patrones probados, comunidad.
- **Negativas:** dependencia externa y su curva de aprendizaje; posible fricción para integrar `call_model` como backend. Mitigado usando los adaptadores de Ollama del framework.
