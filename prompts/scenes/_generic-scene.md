# Prompt genérico — Escena interactiva de un modo (plantilla)

Plantilla reutilizable para pedir a **Claude Design** cualquier escena interactiva de LLM Collective. Rellena los marcadores `{{...}}` con los datos del modo (Council, Dev Team o Second Brain) y pégalo.

> Construido con la estructura de Prompt Forge (role → context → input → instructions → constraints → output). Pensado para que, cuando tengamos los assets de **PixelLab**, sustituir el render placeholder por los sprites sea trivial: el contrato de estados es el mismo.

---

```prompt
<role>
Eres un diseñador de interfaces y de juegos pixel-art. Construyes escenas interactivas en las que personajes representan agentes de IA y actúan según el estado real de un pipeline.
</role>

<context>
LLM Collective es una app local-first con tres modos. Cada modo tiene una "vista interactiva": un escenario pixel-art temático donde los agentes del modo se ven trabajar, en vez de leer un hilo de chat. Esta escena es para el modo {{MODO}}.
El color de acento del modo es {{ACENTO_HEX}} y debe teñir toda la escena.
</context>

<input>
Escenario: {{NOMBRE_ESCENARIO}} (ej. "mesa redonda medieval").
Agentes (personajes):
{{LISTA_AGENTES}}   // cada uno: id, nombre temático, rol real, y su texto de ejemplo

Etapas reales del pipeline (en orden) y qué hace cada personaje en cada una:
{{TABLA_ETAPAS}}    // etapa → comportamiento visual de cada agente
</input>

<instructions>
1. Dibuja la escena en pixel-art dentro de un <canvas> (no imágenes externas). Estética retro de videojuego: paleta limitada, bordes nítidos, image-rendering: pixelated.
2. Implementa un control para iniciar el proceso. Al iniciarse, recorre las etapas de {{TABLA_ETAPAS}} en orden, con una barra de progreso por ETAPAS (no por tiempo/ETA).
3. En cada etapa, anima a los personajes según la tabla: el agente activo se ilumina/anima; los que esperan adoptan pose de espera; los terminados quedan en estado completado.
4. Detalle bajo demanda: al hacer clic en un personaje, un panel lateral muestra su contenido real (su texto de ejemplo del input). Marca con hover los personajes clicables.
5. El acento {{ACENTO_HEX}} tiñe toda la escena (luces, halos, barra, panel).
6. Incluye tema claro y oscuro.
7. Respeta prefers-reduced-motion: si está activo, muestra los estados como poses estáticas sin animación.
</instructions>

<constraints>
- Un solo archivo React autónemo (.jsx), sin dependencias externas salvo React.
- Nada de localStorage/sessionStorage: todo en estado de React en memoria.
- No inventes etapas ni agentes fuera del input. Si algo falta, represéntalo como estado neutro, no lo rellenes.
- Las etapas avanzan con tiempos fijos SOLO como demo; deja el avance de etapa en una función única (ej. advanceStage) para poder cablearla luego a eventos del backend.
- Pixel-art hecho con primitivas de canvas (rectángulos) como PLACEHOLDER. No dependas de assets aún.
</constraints>

<output_format>
Un componente React por defecto, en un único archivo, listo para renderizar. Sin explicación dentro del código salvo comentarios breves que marquen: (a) la función de avance de etapa, (b) el mapa etapa→pose, (c) el punto donde se sustituirán los sprites de PixelLab.
</output_format>

<closing>
Piensa primero la disposición de los personajes y el mapa etapa→pose; luego dibuja. Mantén la lógica de estados separada del dibujo, para que cambiar el decorado no toque la lógica.
</closing>
```

---

## Cómo se sustituirá por los assets de PixelLab

Este prompt produce un **placeholder** dibujado en canvas. Cuando existan los sprites de PixelLab (ver [13.5](../../docs/13-interactive-scenes.md)):

1. El mapa `etapa→pose` ya está aislado → se reemplaza el dibujo de rectángulos por `drawSprite(sheet, frame)`.
2. La función `advanceStage` ya está aislada → se cablea a los eventos SSE reales (`stage:start`, `agent:active`, …).
3. El contrato de agentes/etapas no cambia → el decorado nuevo entra sin tocar la lógica.

Por eso el prompt pide explícitamente marcar esos tres puntos con comentarios.
