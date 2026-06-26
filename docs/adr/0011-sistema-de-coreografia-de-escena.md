# ADR-0011 · Sistema de coreografía de escena dirigido por eventos

**Estado:** Aceptada · **Fecha:** 2026-06-26
**Relacionado:** [14 · SDD de Escenas](../14-scenes-sdd.md), [13 · Vista interactiva](../13-interactive-scenes.md), FR-INT-2, FR-SCN-1..3

## Contexto

La v1 de la vista interactiva (Fase 6) coloca a los personajes en posiciones fijas y
refleja la etapa con poses/halos estáticos. El usuario quiere **movimiento real**: que
los personajes caminen entre posiciones según la etapa (el rey va a la mesa a sintetizar,
el dev camina a la sala de reuniones / cafetera, el bibliotecario recorre estanterías).
Hace falta decidir cómo modelar ese movimiento sin acoplarlo a la lógica del pipeline ni
romper la regla de oro ("la escena refleja el estado real, nunca animación falsa").

## Decisión

Introducir un **motor de escena con coreografía dirigida por eventos**:

- El tema (`SceneTheme v2`) declara **waypoints** (puntos con nombre) y una función pura
  `choreography(state) → { agente: {at, face, act} }` que, dado el estado real de la
  sesión (etapa, agente activo, handoff, datos), devuelve el **objetivo** de cada
  personaje (a qué waypoint ir, mirando a dónde, haciendo qué).
- El **motor** (genérico, en el frontend) compara objetivo vs. estado actual y genera el
  movimiento: tween de posición (rAF) a velocidad de marcha, eligiendo la **tira
  direccional** (8 direcciones) según el rumbo, y al llegar adopta la acción (`talk`,
  `type`, `read`, `synthesize`).
- El mapeo evento SSE → movimiento es **común a los tres modos** (extiende el contrato de
  doc 13 §13.2); cada tema solo define *dónde* están los waypoints y *qué* acción toca,
  no *cuándo* (eso lo dicta el pipeline real).

## Alternativas descartadas

- **Animaciones por línea de tiempo (timeline) precompuestas**: romperían la regla de oro
  (el tiempo real lo marca el pipeline, no una timeline fija) y no se adaptan a etapas de
  duración variable.
- **Físicas / pathfinding completo (grafo de navegación A\*)**: sobredimensionado para
  escenas pequeñas con pocos obstáculos; v2 usa tramos rectos + puntos intermedios `via`.
- **Mantener posiciones fijas con solo poses**: es la v1; no cumple el requisito de
  movimiento real del usuario.

## Consecuencias

- **A favor:** desacopla movimiento de lógica (tema reemplazable, FR-SCN-3); el motor es
  uno solo para los tres modos; respeta la regla de oro (todo paso viene de un evento).
- **En contra / coste:** requiere assets de 8 direcciones + walk cycles por personaje
  (~10 generaciones/personaje) y un motor de animación en el frontend (rAF, selección de
  frames). Se mitiga ejecutando **Council primero** y replicando tras validar.
- **Accesibilidad:** con `prefers-reduced-motion` el motor omite el tween/walk y coloca al
  personaje en el waypoint con la pose estática (NFR-SCN-1).
- Supersede el contrato `SceneTheme` de doc 13 §13.4 (ahora `SceneTheme v2`, doc 14 §14.4).
