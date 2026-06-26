# 06 · Subsistema Second Brain

Implementa FR-S1..S6. Patrón: RAG sobre un vault de Obsidian. Decisión RAG vs fine-tuning en [ADR-0004](adr/0004-rag-vs-finetuning.md).

## Flujo A — Indexado (offline, FR-S1, FR-S2)
```
Vault .md -> chunking -> embeddings (local/nomic-embed-text) -> base vectorial
```
Reindexado incremental por `mtime` (ver [data-model](specs/data-model.md)).

## Flujo B — Consulta (online, FR-S3, FR-S4)
```
Pregunta -> [tunel] -> orquestador -> retrieval top_k -> chairman responde citando notas
```

Secuencia: [diagrams/seq-secondbrain.md](diagrams/seq-secondbrain.md). Arquitectura: [diagrams/03-second-brain.svg](diagrams/03-second-brain.svg).

## Acceso remoto (FR-S5, CON-3)
Túnel seguro (Tailscale/Cloudflare). Nunca puerto abierto. Decisión en [ADR-0006](adr/0006-tunnel-not-open-port.md).

## Privacidad (NFR-3)
- Chairman + vector DB en la misma GPU => las notas no salen a terceros.
- Si el chairman fuera Anthropic/Ollama Cloud, los fragmentos recuperados viajarían al modelo en cada consulta.
- Embedding en local: las notas no salen ni para indexar.

## Conector recomendado
MCP con un servidor de Obsidian, que expone el vault como herramienta de forma estándar.

## Configuración de referencia
```python
EMBED_MODEL = "local/nomic-embed-text"
VECTOR_DB = "chroma"
CHAIRMAN_MODEL = "gpu/llama3.3:70b"
TUNNEL = "tailscale"
COUNCIL_OVERLAY = False   # FR-S6, opcional
TOP_K = 6
```
