# Spec · Repaso de seguridad (Fase 7)

Repaso del modelo de amenazas de [`07-security.md`](../07-security.md) sobre el código
implementado. Fecha: 2026-06-28. Alcance: secretos, validación de entradas, sandbox,
túnel y superficie de error.

Resultado: **sin hallazgos críticos.** Mejoras aplicadas en esta fase marcadas con ✅.

## 1. Secretos (activo crítico)

| Comprobación | Resultado |
|--------------|-----------|
| `.env` ignorado por git | ✅ `git ls-files` no lista `.env`; está en `.gitignore` |
| Claves solo en `.env`, leídas por `os.environ` | ✅ `model_router`, `health`, `verify_models` |
| Claves nunca en logs | ✅ no hay `logging`/`print` de secretos; `verify_models` imprime host y modelos, **no** la clave |
| Claves nunca en URLs / query params | ✅ viajan en headers `Authorization: Bearer …` / `x-api-key`, nunca en la URL |
| `/api/health` no filtra secretos | ✅ `health.model_availability()` devuelve solo booleanos por destino |
| Errores propagados no contienen la clave | ✅ `httpx.HTTPStatusError` incluye la URL (sin clave), no los headers |

**Nota menor (aceptada):** un error de conexión a `gpu/` puede incluir el host interno
(p. ej. IP de Tailscale) en `str(e)` reportado por SSE. El modelo de amenazas asume un
**operador único de confianza** (07-security §"Supuestos"), que es el destinatario de
esa UI; no es una divulgación a terceros. Se deja anotado.

## 2. Validación de entradas (✅ añadido en Fase 7)

Antes, los payloads de consulta no tenían límites → riesgo de DoS (prompt gigante que
gasta tiempo de modelo) y de bucle de corrección desmesurado.

| Endpoint | Control aplicado |
|----------|------------------|
| `POST /api/council/{id}/query` | `content` 1–16 000 chars (`Field(min_length=1, max_length=…)`) → `422` |
| `POST /api/devteam/{id}/task` | `content` 1–16 000 chars; `max_iterations` acotado 1–20 (`MAX_ITERATIONS_CAP`) |
| `POST /api/secondbrain/{id}/query` | `content` 1–16 000 chars; `top_k` acotado 1–50 |

Cubre la amenaza **Denial of service** (07-security): además del `MAX_FIX_ITERATIONS`
del pipeline, el router rechaza un `max_iterations` abusivo antes de empezar.
Test: `tests/test_council_endpoint.py::test_council_query_rejects_empty_and_oversized_content`.

## 3. Sandbox del Dev Team (NFR-4, FR-D3)

| Control | Implementación | Prueba |
|---------|----------------|--------|
| Sin escape de rutas | `Sandbox._resolve` rechaza rutas absolutas y `..` fuera del workdir | TC-D4 |
| Sin herencia de secretos | `run()` construye un `env` limpio (solo `PATH`, `HOME`, `PYTHONDONTWRITEBYTECODE`) | revisión |
| Límites de recursos | `RLIMIT_CPU` (15 s), `RLIMIT_FSIZE` (32 MiB), timeout duro | revisión |
| Workdir efímero | `tempfile` + `cleanup()` en `finally`/`__exit__` | revisión |

**Limitación conocida (ADR-0009):** ejecución por *subprocess*, no contenedor Docker.
Reduce el riesgo (rutas, rlimits, env limpio) pero no aísla a nivel de kernel. La
interfaz está lista para Docker sin tocar los roles. Anotado en `07-security` §"límites".

## 4. Túnel del Second Brain (CON-3, FR-S5, ADR-0006)

| Control | Implementación | Prueba |
|---------|----------------|--------|
| Sin puerto abierto: solo loopback o token | `require_tunnel` / `tunnel_allowed` | TC-S5 |
| Acceso directo externo rechazado | `403 tunnel_required` | TC-S5 |

El token (`SECONDBRAIN_TUNNEL_TOKEN`) se compara por igualdad y vive en `.env`. La
seguridad del transporte depende del proveedor del túnel (Tailscale/Cloudflare), como
indica 07-security.

## 5. Privacidad de datos (NFR-3)

En el perfil por defecto `cloud_only`, los **embeddings salen a Ollama Cloud**. Para la
config 100 % privada hay que mover `EMBEDDINGS_MODEL` a `local/nomic-embed-text` (Ollama
local). Documentado en el README de Second Brain y en `model_config.py`. La verificación
de tráfico (TC-S4) queda como prueba manual (no automatizable sin red real).

## Conclusión

El código respeta el modelo de amenazas. Las dos mejoras de esta fase (validación de
entradas y este repaso) cierran el ítem de seguridad de la Fase 7. Pendientes anotados,
no bloqueantes: sandbox Docker (ADR-0009) y embeddings locales para privacidad plena.
