# 02 · Arquitectura

## 2.1 Vista de capas

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                 │
│  Chat · tabs por modelo · pipeline · citas               │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP + SSE
┌───────────────────────────┴─────────────────────────────┐
│  Backend (FastAPI, async)                                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Orquestador │  │  call_model  │  │  Almacenamiento │  │
│  │ (por app)   │  │  (router)    │  │  JSON + vector  │  │
│  └─────────────┘  └──────┬───────┘  └─────────────────┘  │
└──────────────────────────┼──────────────────────────────┘
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Ollama Cloud       GPU alquilada       Local / Anthropic
  (3 agentes)        (chairman)          (opcional)
```

Detalle visual en [C4 contenedores](diagrams/c4-container.md).

## 2.2 La pieza central: `call_model` (FR-1, NFR-7)

Toda invocación de un modelo pasa por una única función router. Es lo que permite que los tres proyectos compartan plumbing y que el reparto cloud/GPU/local sea configuración, no código. Decisión registrada en [ADR-0003](adr/0003-call-model-router.md).

```python
async def call_model(model_id: str, messages: list[dict], **opts) -> str:
    if model_id.startswith("cloud/"):     # Ollama Cloud
        ...
    elif model_id.startswith("gpu/"):     # GPU alquilada con Ollama
        ...
    elif model_id.startswith("local/"):   # Ollama local
        ...
    elif model_id.startswith("anthropic/"):  # API Anthropic
        ...
```

Implementación de referencia en [`shared/model_router.py`](../shared/model_router.py).

### Contrato

- **Entrada:** `model_id` con prefijo, lista de mensajes en formato `{role, content}`, opciones.
- **Salida:** texto de la respuesta (string). El streaming se gestiona en la capa de orquestación, no aquí.
- **Errores:** `ValueError` si el prefijo es desconocido; `RuntimeError` si falta config (p. ej. `GPU_HOST`); propaga errores HTTP del proveedor para que el orquestador aplique fallback (NFR-6).

## 2.3 Orquestadores

Cada app tiene su orquestador, que es lo único que difiere de verdad:

| App | Topología | Herramientas |
|-----|-----------|--------------|
| Council | Fan-out paralelo → revisión → síntesis | Ninguna (solo texto) |
| Dev Team | Grafo secuencial con bucle de corrección | Ficheros, shell, git, tests |
| Second Brain | Retrieval → síntesis | Lectura del vault + vector DB |

## 2.4 Concurrencia (NFR-2, CON-1)

| Plan Ollama Cloud | Concurrentes | Uso en el proyecto |
|-------------------|--------------|--------------------|
| Free | 1 | Pruebas; las opiniones se serializan |
| **Pro (base)** | **3** | Los 3 agentes en paralelo |
| Max | 10 | Cargas de agentes intensivas |

- El uso se mide por **tiempo de GPU**, no tokens; límites de sesión cada 5 h, semanales cada 7 días.
- El orquestador usa `asyncio.gather` para la etapa de opiniones y la de revisión.
- Si se exceden los 3 slots, las peticiones se encolan; con cola llena, se rechazan → backoff y reintento.
- La GPU alquilada no tiene límite de concurrencia propio salvo VRAM (CON-2).

## 2.5 Flujo de datos y persistencia

- **Conversaciones:** JSON bajo `data/conversations/` (ver [data-model](specs/data-model.md)).
- **Vector DB:** Chroma/LanceDB bajo `data/` (solo Second Brain).
- **Secretos:** `.env`, nunca en el repo. Cubierto por `.gitignore`.

## 2.6 Decisiones de arquitectura registradas

| ADR | Decisión |
|-----|----------|
| [0001](adr/0001-ollama-cloud-vs-openrouter.md) | Ollama Cloud en vez de OpenRouter |
| [0002](adr/0002-chairman-on-rented-gpu.md) | Chairman en GPU alquilada |
| [0003](adr/0003-call-model-router.md) | `call_model` como capa única |
| [0004](adr/0004-rag-vs-finetuning.md) | RAG en vez de fine-tuning (Second Brain) |
| [0005](adr/0005-langgraph-for-devteam.md) | LangGraph/CrewAI para el Dev Team |
| [0006](adr/0006-tunnel-not-open-port.md) | Túnel en vez de puerto abierto |

## 2.7 Atributos de calidad y cómo se logran

| Atributo | Mecanismo |
|----------|-----------|
| Modularidad | `call_model` aísla proveedores; orquestadores aislados por app |
| Privacidad | Datos en GPU/local del usuario; túnel para acceso remoto |
| Coste | GPU bajo demanda; caché de respuestas |
| Resiliencia | Fallback de modelos; backoff ante cola llena |
| Observabilidad | Logs estructurados por etapa (ver [operations](09-operations.md)) |
