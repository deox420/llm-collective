# 13 · Vista interactiva y escenarios temáticos

**Versión:** 1.1 · **Estado:** Borrador · **Fecha:** 2026-06-26
**Depende de:** [12 · Frontend](12-frontend.md), [04 Council](04-council.md), [05 Dev Team](05-dev-team.md), [06 Second Brain](06-second-brain.md)

---

## 13.1 Propósito

Cada modo ofrece **dos vistas** de la misma sesión, intercambiables con un botón en la cabecera:

| Vista | Para qué | Forma |
|-------|----------|-------|
| **Chat** | Preguntar y leer rápido | Hilo de conversación clásico + panel lateral + composer |
| **Interactiva** | Ver a los agentes trabajar | Escenario temático pixel-art donde personajes-agente actúan según el estado real del pipeline |

La vista interactiva **no sustituye** la lógica: es una capa de presentación sobre el mismo estado de sesión. La lógica (qué agentes hay, qué etapas recorren) es fija; el **decorado** encima es un tema reemplazable.

---

## 13.1-bis Reparto de herramientas de diseño

Para evitar ambigüedad, así se reparten las herramientas:

| Parte | Herramienta | Qué produce |
|-------|-------------|-------------|
| **UI / interfaz** (shell, sidebar, vista chat, paneles, layout, paletas, transiciones de color por modo) | **Claude Design** | El diseño visual de la aplicación, a partir de [prompts/claude-design-prompt.md](../prompts/claude-design-prompt.md). |
| **Vista interactiva: escenarios, personajes y animaciones** (mesa redonda, oficina, biblioteca; caballeros/rey/agentes/bibliotecario; sus estados idle/talk/waiting/handoff…) | **PixelLab** (vía su MCP) | Los assets pixel-art: fondos de escena, spritesheets de personajes y sus animaciones. Ver [§13.5](#135-pipeline-de-assets-pixel-art-pixellab), [ASSETS.md](../../ASSETS.md) y [ADR-0007](adr/0007-pixellab-assets.md). |

Matiz importante: **Claude Design NO genera los assets pixel-art finales.** Solo se usa, de forma opcional y desechable, para una *prueba de interpretación* de la escena de Council (ver [§13.6](#136-versión-de-prueba-con-claude-design)); el render final de toda la parte interactiva lo hacen los assets de PixelLab. El componente de escena (código React que consume esos assets según el contrato `SceneTheme`, [§13.4](#134-sistema-de-escenarios-intercambiables)) lo implementa Claude Code en la Fase 6.

---

## 13.2 Principio: la escena refleja el estado real

Los personajes no son decorativos. Cada acción visual **mapea a una etapa real** del pipeline del modo (las mismas etapas que ya alimentan la barra de progreso del chat). El backend emite eventos de etapa por SSE; la escena los traduce a animaciones.

> Regla de oro: si un personaje actúa, es porque el agente correspondiente está en ese estado. Nunca animación falsa.

### Mapeo etapa → animación (contrato genérico)

```
evento SSE        →  estado de escena
─────────────────────────────────────
stage:start(s)    →  activa el "set" de la etapa s
agent:active(id)  →  ilumina/anima al personaje id
agent:waiting(id) →  personaje id en pose de espera
handoff(a→b)      →  transición física de a hacia b
stage:done(s)     →  set de s a estado "completado"
session:done      →  entrega del resultado final
mode:locked       →  escena atenuada / "cerrada"
```

Este contrato es **común a los tres modos**. Cada escenario solo define cómo se ve cada estado, no cuándo ocurre.

---

## 13.3 Los tres escenarios (tema inicial v1)

### Council — La mesa redonda medieval
Tres caballeros (modelos A/B/C) + un rey (chairman) en torno a una mesa redonda.

| Etapa real | Qué hace la escena |
|------------|--------------------|
| `opinions` | Cada caballero habla por turnos: se inclina hacia la mesa, halo de "hablando" |
| `review` | Los caballeros se miran entre sí (líneas de mirada anonimizadas A/B/C) |
| `synthesis` | Energía dorada fluye de los caballeros al rey, que se enciende |
| `done` | Pergamino con sello en el centro de la mesa |
| `locked` | Salón a oscuras |

### Dev Team — La oficina
Cuatro agentes (arquitecto, programador, revisor, tester) con escritorios.

| Etapa real | Qué hace la escena |
|------------|--------------------|
| `agent:active` | El agente está en su escritorio, su pantalla parpadea con código |
| `agent:waiting` | El agente espera en la **máquina de café** |
| `handoff` | Los dos agentes van a la **sala de reuniones** y conversan |
| retorno tester→programador | El tester camina de vuelta al escritorio del programador |
| `locked` | Luces apagadas, escritorios vacíos |

### Second Brain — La biblioteca
Un bibliotecario (agente de recuperación + síntesis).

| Etapa real | Qué hace la escena |
|------------|--------------------|
| `retrieval` | El bibliotecario recorre estanterías y saca **libros** (= notas del vault) |
| `synthesis` | Se sienta a una mesa y los lee |
| `done` | Lleva los libros al **mostrador** y te los "presta" (respuesta + fuentes como recibo) |
| `locked` | Biblioteca cerrada |

---

## 13.4 Sistema de escenarios intercambiables

El escenario es un **tema**, no la lógica. Un mismo modo podrá tener varios temas que comparten el contrato de §13.2:

| Modo | Tema v1 | Temas futuros (mismos roles) |
|------|---------|------------------------------|
| Council | Mesa redonda medieval | Gabinete de abogados · Jurado · Consejo de sabios |
| Dev Team | Oficina | Taller de artesanos · Sala de control · Cocina de restaurante |
| Second Brain | Biblioteca | Archivo · Laboratorio · Despacho de detective |

### Contrato de un tema (`SceneTheme`)

Cada tema implementa la misma interfaz, de modo que cambiarlo no toca la lógica:

```ts
interface SceneTheme {
  id: string;                       // 'council-round-table'
  mode: 'council'|'devteam'|'brain';
  // assets pixel-art (ver §13.5)
  assets: SceneAssets;
  // dónde se sienta/coloca cada agente
  layout(stage: Stage, agents: AgentState[]): Placement[];
  // cómo se ve cada estado de agente en este tema
  poseFor(agent: AgentState, stage: Stage): Pose;
  // detalle bajo demanda al hacer clic en un personaje
  detailFor(agentId: string): DetailCard;
}
```

Un selector de tema (planeado, **no en v1**) permitirá al usuario elegir el decorado por modo. Hasta entonces, cada modo arranca con su tema único.

---

## 13.5 Pipeline de assets pixel-art: **PixelLab**

> Decisión registrada en [ADR-0007](adr/0007-pixellab-assets.md).

El pixel-art de producción se generará con **[PixelLab](https://www.pixellab.ai/)**, una herramienta de IA para assets de juego (sprites, animaciones por esqueleto, rotaciones 4/8 direcciones, escenas/tilesets, inpainting con consistencia de estilo). Ofrece editor en navegador, plugin de Aseprite, **API** y **MCP** ("vibe coding").

### Por qué PixelLab
- Genera sprites **animados** (idle, hablar, caminar, esperar) que es justo lo que cada estado de escena necesita.
- **Consistencia de estilo** por referencia: los 4 personajes de un modo comparten paleta y trazo.
- **Inpainting real**: editar un sprite (cambiar color de túnica, añadir corona) sin rehacerlo.
- **API/MCP**: en el futuro, regenerar un tema entero de forma programática.

### Flujo de trabajo de assets

```
1. Definir el tema (este doc, §13.3/§13.4)
2. PixelLab: generar sprites por personaje y por estado
   - sprite base + animaciones (idle / active / waiting / handoff)
   - escena de fondo (mesa, oficina, biblioteca) como tileset/escena
3. Exportar spritesheets + metadata (frames, anclas)
4. Colocar en /assets/scenes/<theme-id>/
5. El componente de escena consume el SceneTheme (§13.4) → sin tocar lógica
```

### Estructura de assets esperada

```
/assets/scenes/council-round-table/
  background.png            # salón + mesa
  knight-a.sheet.png        # spritesheet del caballero A
  knight-a.json             # frames: idle, speak, look, dim
  knight-b.sheet.png
  knight-c.sheet.png
  king.sheet.png            # idle, synthesize, deliver
  scroll.png                # pergamino del veredicto
  theme.json                # implementa SceneTheme (§13.4)
```

Mientras no existan los assets de PixelLab, el prototipo usa **figuras dibujadas en canvas** (placeholder) con el mismo contrato, de modo que sustituir placeholder → sprite es solo cambiar `assets` en el tema.

---

## 13.6 Versión de prueba con Claude Design

Para **evaluar cómo Claude Design interpreta y renderiza pixel-art**, se generará una versión de demostración de la escena de Council mediante el prompt de [prompts/scenes/council-scene.md](../prompts/scenes/council-scene.md).

**Importante — esta versión es desechable:**
- Es una *prueba de interpretación*, no el render final.
- El render final usará assets de PixelLab (§13.5), no lo que produzca Claude Design.
- Sirve para: validar layout, animación de estados e interacción (clic → detalle) antes de invertir en assets.
- Tratarla como una **rama/versión de exploración** que no interviene en el desarrollo final.

---

## 13.7 Requisitos derivados

| ID | Requisito |
|----|-----------|
| FR-INT-1 | Cada modo ofrece vista Chat y vista Interactiva, alternables desde la cabecera |
| FR-INT-2 | La vista interactiva refleja el estado real del pipeline vía eventos SSE (§13.2) |
| FR-INT-3 | Clic en un personaje muestra su contenido real (opinión, código, fragmento de nota) |
| FR-INT-4 | Mientras un modo trabaja, los demás aparecen bloqueados también en la escena |
| FR-INT-5 | El color de acento del modo tiñe toda la escena |
| FR-INT-6 | Un tema implementa `SceneTheme` (§13.4); cambiar de tema no altera la lógica |
| NFR-INT-1 | Respetar `prefers-reduced-motion`: sin animación, estados como poses estáticas |
| NFR-INT-2 | La escena no bloquea la vista chat; ambas leen el mismo estado de sesión |
| CON-INT-1 | Los assets pixel-art se generan con PixelLab (ADR-0007) |
