# ADR-0007 · PixelLab como pipeline de assets pixel-art

**Estado:** Aceptada · **Fecha:** 2026-06-26

## Contexto
La vista interactiva ([13 · Escenas](../13-interactive-scenes.md)) usa escenarios temáticos en pixel-art donde personajes-agente actúan según el estado real del pipeline. Cada modo necesita sprites animados (idle, hablar, esperar, caminar) consistentes en estilo, más una escena de fondo. Hacer esto a mano es lento y difícil de mantener coherente.

## Opciones consideradas
1. **Pixel-art dibujado a mano** (Aseprite manual) — control total, pero costoso y lento de iterar.
2. **Sprites dibujados en canvas por código** (lo del prototipo) — cero assets, pero limitado y poco "pixel-art real".
3. **PixelLab** — generación por IA de sprites, animaciones por esqueleto, rotaciones, escenas/tilesets, con consistencia de estilo, inpainting, API y MCP.
4. **Otros generadores de imágenes genéricos** — no especializados en pixel-art ni en animación de sprites.

## Decisión
Adoptar **[PixelLab](https://www.pixellab.ai/)** como pipeline de assets pixel-art de producción (CON-INT-1).

## Justificación
- Especializado en **sprites animados** por estado (idle/active/waiting/handoff), justo lo que cada escena necesita.
- **Consistencia de estilo por referencia**: los 4 personajes de un modo comparten paleta y trazo.
- **Inpainting real**: editar un sprite (color de túnica, añadir corona) sin rehacerlo.
- **API + MCP**: permite regenerar un tema entero de forma programática en el futuro.
- Funciona en navegador y como plugin de Aseprite; no requiere GPU local.

## Consecuencias
- **Positivas:** assets profesionales y coherentes, iteración rápida, edición no destructiva, posible automatización vía API.
- **Negativas:** dependencia de un servicio externo de pago; los assets se generan fuera del repo y se versionan como binarios. Aceptable.
- **Frontera:** mientras no haya assets, el prototipo usa figuras de canvas como placeholder con el **mismo contrato** (`SceneTheme`), de modo que sustituir placeholder → sprite no toca la lógica.

## Nota sobre la prueba con Claude Design
La versión de Council generada con Claude Design (ver [prompt](../../prompts/scenes/council-scene.md)) es una **prueba de interpretación desechable**, no el render final. El render final usa PixelLab. No interviene en el desarrollo final.
