# Second Brain

RAG sobre un vault de Obsidian, accesible en remoto solo por túnel. Ver
`docs/06-second-brain.md` y SDD §3.3.

- **Indexado** (FR-S1): trocea notas `.md` por headings con solape, genera
  embeddings locales (`nomic-embed-text`) y los guarda en el vector store (Chroma).
  Reindexado **incremental** por `mtime` (FR-S2): solo recalcula notas modificadas.
- **Consulta** (FR-S3/S4): recupera los chunks más relevantes y el chairman responde
  **citando** las notas fuente. Etapas SSE: `retrieval → synthesis`.
- **Privacidad** (NFR-3): embeddings y vector DB son locales; con perfil local el
  chairman también, así las notas no salen de la infraestructura del usuario.

## Cómo arrancar

```bash
uv sync --extra secondbrain               # añade Chroma
uv run uvicorn app:app --reload           # backend en :8000
cd frontend && npm install && npm run dev # UI en :5173
```

## Configuración

```bash
# .env
MODEL_PROFILE=cloud_only                 # EMBEDDINGS_MODEL/CHAIRMAN_MODEL salen de aquí
LLMC_DATA_DIR=data                       # dónde persiste el vector store (data/vector)
SECONDBRAIN_TUNNEL_TOKEN=...             # token del túnel para acceso remoto (ver abajo)
```

Para máxima privacidad usa un perfil con `EMBEDDINGS_MODEL=local/nomic-embed-text`
(gratis y sin salir del host).

## Acceso remoto solo por túnel (FR-S5, CON-3, ADR-0006)

Las rutas dependen de `require_tunnel`: se admite **solo** tráfico de loopback o con
la cabecera `X-Tunnel-Token` igual a `SECONDBRAIN_TUNNEL_TOKEN`. Cualquier otro
acceso directo → `403 tunnel_required`. **Nunca** se abre un puerto a internet; se
expone vía Tailscale/Cloudflare Tunnel.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/secondbrain/index` `{vault_path, full?}` | indexa el vault (202 + job) |
| GET | `/api/secondbrain/index/{job_id}` | estado del job de indexado |
| POST | `/api/secondbrain/{conversation_id}/query` `{content, top_k?}` | consulta RAG (SSE) |

`content` se valida (1–20 000 caracteres); `top_k` acotado a 1–50. La consulta corre
bajo el lock global → `409 mode_busy` si otro modo está activo.

## Tests

```bash
uv run pytest tests/test_secondbrain.py tests/test_secondbrain_endpoint.py
```

Cubren chunking, store, indexado incremental (TC-S2), que la respuesta cita notas
reales (TC-S3), el túnel rechaza acceso directo (TC-S5) e index+query end-to-end.
