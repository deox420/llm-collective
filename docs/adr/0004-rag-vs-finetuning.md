# ADR-0004 · RAG en vez de fine-tuning para el Second Brain

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
El Second Brain debe responder desde las notas del usuario. Dos enfoques: recuperar fragmentos relevantes en tiempo de consulta (RAG) o entrenar/afinar un modelo sobre las notas (fine-tuning).

## Decisión
Usar **RAG**: indexar el vault en una base vectorial y recuperar chunks relevantes que se pasan al chairman como contexto.

## Justificación
- Las notas cambian a menudo; RAG refleja cambios con un reindexado incremental, fine-tuning exigiría reentrenar.
- RAG permite citar la nota de origen (FR-S4); un modelo afinado no traza la fuente.
- El embedding puede hacerse en local con `nomic-embed-text`, gratis y sin que las notas salgan para indexar.
- Fine-tuning es caro, lento y arriesga memorizar/filtrar datos.

## Consecuencias
- **Positivas:** frescura, trazabilidad, privacidad, bajo coste.
- **Negativas:** la calidad depende de la recuperación; chunks mal recuperados degradan la respuesta. Mitigado con buen chunking y reranking opcional.
