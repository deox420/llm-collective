# ADR-0003 · `call_model` como capa única de enrutado

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
Tres apps invocan modelos en cuatro ubicaciones posibles (cloud, GPU, local, Anthropic). Sin abstracción, cada app duplicaría lógica de transporte y formato.

## Decisión
Centralizar toda invocación en una única función `call_model(model_id, messages, **opts)` que enruta por el prefijo del `model_id`.

## Justificación
- Cumple NFR-7 (bajo acoplamiento): un solo módulo conoce los proveedores.
- Cambiar dónde corre un modelo = cambiar un string en la config.
- El endpoint de Ollama (cloud/GPU/local) es el mismo `/api/chat`; solo cambia el host, lo que hace la abstracción casi trivial.
- Anthropic necesita adaptar el payload (system separado, max_tokens); ese caso especial queda encapsulado.

## Consecuencias
- **Positivas:** apps más simples, pruebas más fáciles (se mockea un solo punto), portabilidad.
- **Negativas:** la función router es un punto único; debe estar bien cubierta por pruebas. El streaming se gestiona fuera (en el orquestador), porque difiere por app.
