# Second Brain

RAG sobre un vault de Obsidian. Ver `docs/06-second-brain.md` y SDD §3.3.

- **Indexado** (FR-S1/S2): trocea notas `.md` por headings (con solape), genera
  embeddings locales (`nomic-embed-text`) y los guarda en Chroma. Reindexado
  **incremental por `mtime`**: solo recalcula chunks de notas modificadas y borra los
  de notas eliminadas.
- **Consulta** (FR-S3/S4): recupera los chunks top-k y el *chairman* responde
  **citando las notas reales** recuperadas; etapas `retrieval → synthesis` por SSE.
- **Privacidad** (NFR-3): embeddings + vector DB locales; en `cloud_only` el embedding
  va por cloud, pero el diseño previsto los mantiene en GPU/host del usuario.

## Acceso remoto solo por túnel (FR-S5, CON-3, ADR-0006)

Las rutas dependen de `require_tunnel`: solo aceptan peticiones de **loopback** o con el
header `x-tunnel-token` == `SECONDBRAIN_TUNNEL_TOKEN`. Acceso directo externo → `403`.
**Nunca** se abre un puerto a internet; se publica por Tailscale/Cloudflare.

## Cómo arrancar

Necesita el extra `secondbrain` (Chroma):

```bash
uv sync --extra secondbrain
uv run uvicorn app:app --reload          # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173 (vista Chat → Second Brain)
```

## Configuración

```env
# .env
MODEL_PROFILE=cloud_only
SECONDBRAIN_TUNNEL_TOKEN=…        # opcional: habilita acceso remoto autenticado
LLMC_DATA_DIR=data               # dónde persiste la vector DB (data/vector)
```

```python
# shared/model_config.py
EMBEDDINGS_MODEL = "cloud/nomic-embed-text"   # con Ollama local → local/nomic-embed-text (gratis, más privado)
```

## API (ver `docs/specs/api-spec.md`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| `POST` | `/api/secondbrain/index` `{ "vault_path": "…", "full": false }` | indexa (202, incremental) |
| `GET`  | `/api/secondbrain/index/{job_id}` | estado del job de indexado |
| `POST` | `/api/secondbrain/{conversation_id}/query` `{ "content": "…", "top_k": 6 }` | RAG (SSE) |

Eventos SSE: `retrieved`, `answer`, `citations`, `session:done`. Concurrencia: lock
global `brain`. Entrada validada: `content` 1–16 000 chars, `top_k` 1–50.

## Tests

`uv run pytest tests/test_secondbrain.py tests/test_secondbrain_endpoint.py` — chunking,
store, indexado incremental (TC-S2), la respuesta cita notas reales (TC-S3), el túnel
rechaza el acceso directo (TC-S5), index+query end-to-end.
