# 09 · Despliegue y operación

## Provisionar la GPU del chairman (ADR-0002)
1. Crear instancia en Runpod/Vast.ai/Lambda con VRAM >= la del modelo chairman (CON-2).
2. Instalar Ollama; `ollama pull <modelo>`.
3. Arrancar Ollama con `OLLAMA_HOST=0.0.0.0:11434` **solo accesible dentro del tunel** (no exponer a internet, CON-3).
4. Registrar la instancia en la red del tunel (Tailscale/Cloudflare).
5. Apuntar `GPU_HOST` al endpoint privado.
6. **Apagar la instancia al terminar** (facturacion por horas, NFR-5).

## Variables de entorno
```env
OLLAMA_CLOUD_HOST=https://ollama.com
OLLAMA_CLOUD_API_KEY=...
GPU_HOST=http://<tailscale-ip>:11434
ANTHROPIC_API_KEY=        # opcional
```

## Arranque local
```bash
uv sync
cd frontend && npm install && cd ..
./start.sh        # backend (FastAPI) + frontend (Vite)
```

## Observabilidad (atributo de calidad)
- Logs estructurados por etapa: `stage`, `model_id`, `latency_ms`, `tokens`, `cache_hit`.
- Para el dev-team, log de cada `tool_call` con rol, herramienta y resultado (trazabilidad / no repudio, ver 07-security).
- Healthcheck `GET /api/health` refleja disponibilidad de cada destino de modelo.

## Runbook breve
| Sintoma | Causa probable | Accion |
|---------|----------------|--------|
| `gpu_not_configured` 503 | GPU_HOST vacio o instancia apagada | Encender GPU, fijar GPU_HOST |
| `queue_full` 429 | 3 slots de cloud ocupados | Backoff; valorar plan Max |
| Council muy lento | Plan Free (1 concurrente) | Subir a Pro |
| Respuestas sin citar (Second Brain) | Vault no indexado | Ejecutar /api/secondbrain/index |
| Coste alto inesperado | GPU encendida 24/7 | Activar apagado por inactividad |

## Backups
- `data/conversations/` y la vector DB: backup periodico si el contenido importa.
- La vector DB es regenerable desde el vault; el vault de Obsidian es la fuente de verdad.

---

## Notas de despliegue (Fase 7)

### Perfiles según dónde despliegues
El perfil activo se elige con `MODEL_PROFILE` (`shared/model_config.py`); cambiarlo
no toca código. Físico vs alquiler vs cloud es solo el prefijo del modelo.

| Objetivo | `MODEL_PROFILE` | Requiere |
|----------|-----------------|----------|
| Construir/probar sin GPU | `cloud_only` (defecto) | `OLLAMA_CLOUD_API_KEY` |
| Trastear gratis en tu equipo | `local_dev` | Ollama local (`OLLAMA_LOCAL_HOST`) |
| Producción con chairman en GPU | `cloud_plus_gpu` | `GPU_HOST` por túnel + cloud |

### Variables de entorno completas
```env
MODEL_PROFILE=cloud_only           # perfil de modelos
OLLAMA_CLOUD_HOST=https://ollama.com
OLLAMA_CLOUD_API_KEY=...            # destino cloud/
OLLAMA_LOCAL_HOST=http://localhost:11434   # destino local/
GPU_HOST=http://<tailscale-ip>:11434       # destino gpu/ (solo por túnel, CON-3)
ANTHROPIC_API_KEY=                 # opcional, destino anthropic/
LLMC_DATA_DIR=data                 # conversaciones + vector store
SECONDBRAIN_TUNNEL_TOKEN=...       # acceso remoto del Second Brain (FR-S5)
```
Nada de esto va al repo (`.env` está en `.gitignore`). Las respuestas de `/api/health`
y los logs **nunca** incluyen claves ni hosts, solo booleanos de disponibilidad.

### Arranque
`./start.sh` levanta backend (FastAPI :8000) y frontend (Vite :5173) y los detiene
juntos con Ctrl-C. Equivale a `uv sync --extra devteam --extra secondbrain` +
`uvicorn app:app` + `npm run dev`.

### Fiabilidad y coste en operación
- **Fallback (NFR-6):** si un modelo da 5xx/404 o el host no responde (p. ej. la GPU
  apagada), `call_model` reintenta con el modelo de reserva del perfil
  (`FALLBACKS`, ADR-0010). Revisa/ajusta el mapa al elegir modelos.
- **Caché (FR-5, palanca de ahorro §08):** respuestas idénticas no repiten llamada.
  `cache_hit` se cuenta en `model_router.CACHE_HITS` para la métrica de §observabilidad.

### Egress requerido
El entorno debe permitir salida HTTPS a `ollama.com` (modelos cloud y embeddings) y,
si se usa, `api.anthropic.com`. En el entorno de construcción remoto estos hosts
estaban bloqueados (403); por eso las corridas se validaron con modelos *faked*. En
un despliegue real, añádelos al allowlist o ejecuta en una red con egress.
