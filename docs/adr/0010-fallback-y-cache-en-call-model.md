# ADR-0010 · Fallback y caché de respuestas en `call_model`

**Estado:** Aceptada · **Fecha:** 2026-06-26
**Relacionado:** NFR-6, FR-5, NFR-7, [02-architecture.md](../02-architecture.md), [08-costs.md](../08-costs.md), [09-operations.md](../09-operations.md)

## Contexto

El SDD pide dos comportamientos sin fijar su mecanismo:

- **NFR-6 (fiabilidad):** «Si un modelo cloud falla o no existe, hay fallback
  configurable.» (caso de prueba TC-6: un 502 dispara el fallback configurado).
- **FR-5 / §8.2 (coste):** el sistema cachea respuestas idénticas para no repetir
  llamadas; §9 lista `cache_hit` como métrica de observabilidad.

NFR-7 obliga a centralizar la invocación de modelos en un solo módulo
(`shared/model_router.py`), así que ambos comportamientos deben vivir ahí y no
duplicarse en cada app.

## Decisión

Implementar fallback y caché **dentro de `call_model`**, de forma transparente para
los orquestadores (council, dev-team, second-brain no cambian).

### Fallback (NFR-6)
- La tabla de reserva es **configurable por perfil**: `model_config.PROFILES[*]["fallbacks"]`
  (mapa `model_id → model_id`), expuesta como `model_config.FALLBACKS` y consultable
  con `fallback_for(model_id)`.
- `call_model` reintenta **una sola vez** con el modelo de reserva cuando el error es
  «recuperable»: respuesta `5xx`, `404` (el modelo «no existe» en el catálogo) o un
  error de transporte (host caído, p. ej. la GPU alquilada apagada).
- El reintento se hace con `allow_fallback=False` para no encadenar reintentos; si la
  reserva también falla (o no hay reserva, o la reserva es el mismo modelo), el error
  se propaga para que el orquestador decida (p. ej. Council sigue con quorum parcial).
- Un `ValueError` por prefijo desconocido **no** dispara fallback (es un error de
  configuración, no de disponibilidad).

### Caché (FR-5)
- Caché en memoria, por proceso, clave `sha256(model_id + messages + opts)`. Dos
  llamadas idénticas hacen **una sola** petición de red (TC-5).
- Activada por defecto; desactivable por llamada con `use_cache=False` para casos que
  exijan recomputar.
- Contador `CACHE_HITS` expuesto para la métrica `cache_hit` (§9). `clear_cache()`
  para operación y aislamiento de tests.

## Consecuencias

- **A favor:** fiabilidad y ahorro (NFR-5/§8 «palanca 2») sin tocar la lógica de las
  apps; la política de reserva se cambia editando un perfil, no código.
- **En contra / límites:** la caché es por proceso (no compartida entre réplicas) y no
  expira por TTL; suficiente para el despliegue local-first de un usuario. Una caché
  persistente o distribuida sería un ADR posterior si el despliegue escala.
- La caché asume que `(model_id, messages, opts)` idénticos deben dar la misma
  respuesta; correcto para el flujo actual (cada agente recibe prompts distintos). Si
  en el futuro se quiere variación deliberada con el mismo prompt, usar
  `use_cache=False`.
