# Spec · API REST + SSE

Contrato de la API del backend FastAPI. Todas las rutas bajo `/api`. El streaming usa Server-Sent Events.

## Convenciones

- Formato: JSON. `Content-Type: application/json`.
- Errores: código HTTP + cuerpo `{ "error": { "code": "...", "message": "..." } }`.
- Streaming: endpoints marcados `(SSE)` devuelven `text/event-stream`.
- IDs: UUID v4 en string.

## Endpoints comunes

### `POST /api/conversations`
Crea una conversación.

Request:
```json
{ "project": "council | dev-team | second-brain" }
```
Response `201`:
```json
{ "id": "uuid", "project": "council", "created_at": "iso8601" }
```

### `GET /api/conversations/{id}`
Devuelve la conversación con todos sus mensajes. `404` si no existe.

### `GET /api/conversations`
Lista conversaciones (resumen). Query opcional `?project=`.

### `GET /api/health`
`200 { "status": "ok", "models": { "cloud": true, "gpu": false } }` — refleja disponibilidad de cada destino.

## Council

### `POST /api/council/{conversation_id}/query` (SSE)
Lanza el flujo de tres etapas. Request:
```json
{ "content": "tu pregunta" }
```

Eventos SSE emitidos en orden:
```
event: stage1_opinion
data: { "model": "cloud/qwen3:32b", "content": "...", "partial": true }

event: stage1_complete
data: { "models": ["cloud/qwen3:32b", "..."] }

event: stage2_review
data: { "reviewer": "anon-1", "rankings": [{ "candidate": "anon-2", "score": 8 }] }

event: stage3_final
data: { "content": "respuesta del chairman", "partial": true }

event: done
data: { "conversation_id": "uuid" }
```

Cubre FR-C1..C4. Errores parciales (un agente falla) se emiten como:
```
event: model_error
data: { "model": "cloud/...", "code": "queue_full" }
```

## Dev Team

### `POST /api/devteam/{conversation_id}/task` (SSE)
Lanza el pipeline. Request:
```json
{ "content": "Escribe una función X con tests", "max_iterations": 5 }
```

Eventos:
```
event: role_start
data: { "role": "architect", "model": "gpu/qwen3:72b" }

event: role_output
data: { "role": "architect", "content": "...", "partial": true }

event: tool_call
data: { "role": "programmer", "tool": "write_file", "args": { "path": "..." } }

event: test_result
data: { "passed": false, "summary": "2 failed", "iteration": 1 }

event: loop_back
data: { "to": "programmer", "iteration": 2 }

event: delivery
data: { "files": ["..."], "tests_passed": true }

event: done
data: { "conversation_id": "uuid" }
```

Cubre FR-D1..D5. Las `tool_call` ocurren dentro del sandbox (ver 07-security).

## Second Brain

### `POST /api/secondbrain/index`
Dispara indexado (incremental por defecto). Request:
```json
{ "vault_path": "/ruta/al/vault", "full": false }
```
Response `202`:
```json
{ "job_id": "uuid", "chunks_queued": 128 }
```

### `GET /api/secondbrain/index/{job_id}`
Estado del indexado: `{ "status": "running|done", "chunks_done": 128, "chunks_total": 128 }`.

### `POST /api/secondbrain/{conversation_id}/query` (SSE)
Consulta RAG. Request:
```json
{ "content": "¿qué decidí sobre X?", "top_k": 6, "council_overlay": false }
```

Eventos:
```
event: retrieved
data: { "notes": [{ "note_path": "...", "heading": "...", "snippet": "...", "score": 0.82 }] }

event: answer
data: { "content": "...", "partial": true }

event: citations
data: { "notes": ["ruta/nota1.md", "ruta/nota2.md"] }

event: done
data: { "conversation_id": "uuid" }
```

Cubre FR-S3, FR-S4, FR-S6.

## Códigos de error

| code | HTTP | Significado |
|------|------|-------------|
| `unknown_model_prefix` | 400 | `model_id` con prefijo no soportado |
| `gpu_not_configured` | 503 | `GPU_HOST` ausente |
| `queue_full` | 429 | Cola de Ollama Cloud llena |
| `model_unavailable` | 502 | El proveedor no respondió; aplicar fallback |
| `vault_not_found` | 404 | Ruta de vault inexistente |
| `sandbox_error` | 500 | Fallo al ejecutar herramienta en sandbox |
