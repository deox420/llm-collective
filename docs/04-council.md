# 04 · Subsistema Council

Implementa FR-C1..C4. Patrón: ensemble democrático + peer review.

## Flujo

1. **Etapa 1 — Opiniones (FR-C1).** La pregunta va a los N agentes en paralelo (`asyncio.gather`). Se recogen las respuestas y se emiten por SSE conforme llegan.
2. **Etapa 2 — Revisión (FR-C2).** A cada agente se le pasan las respuestas de los otros con identidades anonimizadas (`anon-1`, `anon-2`…) para evitar favoritismos, y rankea por precisión e insight.
3. **Etapa 3 — Síntesis (FR-C3).** El chairman recibe respuestas + rankings y produce la respuesta final.

Diagrama de secuencia: [diagrams/seq-council.md](diagrams/seq-council.md). Diagrama de arquitectura: [diagrams/01-council.svg](diagrams/01-council.svg).

## Configuración de referencia
```python
COUNCIL_MODELS = ["cloud/qwen3:32b", "cloud/deepseek-r1:32b", "cloud/llama3.3:70b"]
CHAIRMAN_MODEL = "gpu/llama3.3:70b"
ANONYMIZE = True
CACHE = True
```

## Anonimización (FR-C2)
Antes de la revisión, el orquestador construye un mapa `modelo -> anon-N` aleatorio por consulta. El revisor solo ve etiquetas anónimas. El mapa se guarda en `stage_data` para auditoría pero no se expone al modelo.

## Optimizaciones (NFR-1, NFR-2, FR-5)
- Paralelizar etapas 1 y 2 con `gather`.
- Cachear por (consulta, modelo).
- Streaming SSE por etapa.

## Riesgos específicos
- El ranking entre modelos no es un juez fiable; coincidencia ≠ verdad. La UI debe presentar las opiniones individuales, no solo la síntesis, para que el usuario juzgue.
- El chairman hereda sus sesgos a la respuesta final; documentarlo en la UI.
