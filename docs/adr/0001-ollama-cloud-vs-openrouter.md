# ADR-0001 · Ollama Cloud en vez de OpenRouter

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
El proyecto original (`llm-council`) usa OpenRouter como pasarela a múltiples modelos. Necesitamos decidir la pasarela para los agentes del consejo y los roles del dev-team, optimizando coste, privacidad y simplicidad operativa.

## Opciones consideradas
1. **OpenRouter** — una clave para muchos proveedores; coste por token + 5,5 % de fee sobre compra de créditos; modelos frontera de pago.
2. **Ollama Cloud** — modelos abiertos en datacenter; uso medido por tiempo de GPU; plan Pro con 3 concurrentes a 20 $/mes; mismo endpoint que Ollama local.
3. **APIs directas de cada proveedor** — máxima calidad, pero gestión de N claves y N facturas.

## Decisión
Usar **Ollama Cloud** como pasarela principal de los agentes, dejando la API de Anthropic como opción puntual para el chairman si se quiere máxima calidad.

## Justificación
- El endpoint de Ollama Cloud es idéntico al de Ollama local: la misma función `call_model` sirve para cloud, GPU alquilada y local sin reescribir nada (ver ADR-0003).
- El plan Pro da 3 concurrentes, justo el número de agentes del consejo base.
- Privacidad: Ollama declara no loguear ni entrenar con los prompts.
- Coste predecible por tiempo de GPU, sin fee de compra de créditos.

## Consecuencias
- **Positivas:** simplicidad (un endpoint), coste contenido, paralelismo real con Pro.
- **Negativas:** los modelos abiertos no igualan a los frontera de pago; mitigado poniendo un chairman potente (ADR-0002) o Anthropic puntual.
- Los modelos del catálogo cloud pueden rotar; se fijan IDs y se define fallback (NFR-6).
