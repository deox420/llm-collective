# ADR-0002 · Chairman en GPU alquilada por horas

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
El chairman produce la síntesis final: es la llamada más larga y donde más importa la calidad. Hay que decidir dónde corre.

## Opciones consideradas
1. **Otro agente en Ollama Cloud** — consume cuota cloud justo en la llamada más cara; compite por los 3 slots con los agentes.
2. **GPU alquilada por horas** (Runpod/Vast.ai) corriendo Ollama dedicado — control total, modelo grande, encendido bajo demanda.
3. **API de Anthropic** — máxima calidad, pero coste recurrente por token y los datos salen a un tercero.
4. **GPU local propia** — gratis pero limitada por el hardware del usuario.

## Decisión
Ejecutar el chairman en una **GPU alquilada por horas** corriendo Ollama, con la API de Anthropic como alternativa opcional configurable.

## Justificación
- No gasta cuota de Ollama Cloud en la síntesis, dejando los 3 slots para los agentes.
- Permite un modelo de chairman mayor que el de los agentes (mejor síntesis).
- Coste bajo demanda: se enciende para la sesión y se apaga después.
- Para el Second Brain, mantener chairman + vector DB en la misma GPU evita que las notas salgan a terceros (ver ADR-0004 y 07-security).

## Consecuencias
- **Positivas:** calidad de síntesis, control, privacidad, coste por horas.
- **Negativas:** fricción operativa (provisionar/apagar la instancia); el modelo debe caber en VRAM (CON-2). Mitigado con scripts de arranque/apagado automático.
