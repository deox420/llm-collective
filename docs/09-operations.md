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
