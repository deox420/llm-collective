# ADR-0010 · Second Brain: embeddings locales (Ollama Cloud no los ofrece)

**Estado:** Aceptada · **Fecha:** 2026-06-28
**Relacionado:** FR-S1, NFR-3, [06-second-brain.md](../06-second-brain.md), [specs/data-model.md](../specs/data-model.md), ADR-0004

## Contexto

El SDD y `model_config.py` asumían que los embeddings del Second Brain podían
generarse vía Ollama Cloud (el perfil `cloud_only` apuntaba a
`cloud/nomic-embed-text`). Verificado contra la cuenta real (2026-06-28):

- **Ollama Cloud no expone embeddings.** `POST /api/embeddings` devuelve `404`
  ("path not found") y el endpoint nuevo `POST /api/embed` devuelve `401`
  ("unauthorized") **con la misma clave que sí funciona para `/api/chat`**. El
  catálogo público (`/api/tags`, 35 modelos) no incluye ningún modelo de embeddings.
- Por tanto, ningún `cloud/...-embed-*` puede satisfacer FR-S1 (trocear → **generar
  embeddings** → vector store). El chat sí funciona en cloud; los embeddings no.

Esto invalida una suposición del SDD, así que se registra como decisión propia.

## Decisión

**Los embeddings del Second Brain se generan SIEMPRE en Ollama local** (`local/`),
nunca en cloud. En todos los perfiles, `embeddings_model = "local/nomic-embed-text"`.

- El perfil `cloud_only` usa cloud para el chat (council, chairman, dev-team) y
  **local para los embeddings**: requiere un Ollama local corriendo
  (`OLLAMA_LOCAL_HOST`, por defecto `http://localhost:11434`) con
  `nomic-embed-text` descargado (`ollama pull nomic-embed-text`).
- Si no hay Ollama local, las apps **Council y Dev Team siguen funcionando** (son
  100% cloud). Solo el Second Brain necesita el daemon local. El fallo, si falta, es
  **ruidoso**: `embed_text` lanza error de conexión → el router del brain emite
  `model_error` por SSE (no falla en silencio).

Esta decisión refuerza además **NFR-3 (privacidad)**: el contenido del vault no sale
a terceros para generar embeddings, ya que se calculan en la máquina del usuario.

## Consecuencias

- **Positivas:** Second Brain verificado end-to-end con embeddings reales
  (`nomic-embed-text`, 768-dim) + Chroma + chairman cloud citando notas reales;
  mayor privacidad (embeddings locales, alineado con NFR-3 y ADR-0004); el resto del
  sistema no depende de Ollama local.
- **Negativas / límites:** el perfil "todo cloud" deja de ser literalmente "todo
  cloud" para el Second Brain — necesita un Ollama local para esa vertical. En el
  entorno de construcción (contenedor remoto) hay que **permitir `registry.ollama.ai`**
  en el egress para `ollama pull` (está bloqueado por defecto).
- **Acción futura:** si en el futuro Ollama Cloud (u otro proveedor enrutado por
  `call_model`) ofrece embeddings, basta cambiar `embeddings_model` al prefijo
  correspondiente; no se toca la lógica de ninguna app. No se revierte sin un ADR que
  lo supere.
```python
# shared/model_config.py — en todos los perfiles
"embeddings_model": "local/nomic-embed-text",
```
