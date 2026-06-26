# 14 · SDD de Escenas Interactivas

**Versión:** 1.0 · **Estado:** Borrador para revisión · **Fecha:** 2026-06-26
**Depende de / extiende:** [12 · Frontend](12-frontend.md), [13 · Vista interactiva](13-interactive-scenes.md), [ADR-0007 · PixelLab](adr/0007-pixellab-assets.md)
**Supersede:** doc 13 §13.4 (contrato `SceneTheme`) — aquí se define `SceneTheme v2` con movimiento.

Documento de diseño **dedicado a la vista interactiva**: personajes, animaciones,
objetos, escenarios y —lo nuevo— **por dónde y cómo se mueven los personajes**. El
resto del SDD (núcleo, las tres verticales) no cambia; esto solo afecta a la capa de
presentación interactiva, que ya está aislada por el contrato `SceneTheme`.

---

## 14.0 Por qué este SDD

La v1 de la escena (doc 13, Fase 6) coloca a los personajes en **posiciones fijas** y
refleja la etapa con halos/poses estáticas. No hay desplazamiento: el rey no se levanta
y va a la mesa, el dev no camina a la sala de reuniones, el bibliotecario no recorre las
estanterías. Este SDD rehace las escenas con **movimiento real guiado por el estado del
pipeline**, arte más grande y detallado, y un contrato que cuadra personajes, animaciones,
objetos y escenario.

### Decisiones de diseño tomadas (input del usuario)
| Eje | Decisión |
|-----|----------|
| **Movimiento** | **Real**: los personajes caminan entre posiciones según la etapa real (walk cycles + rutas). |
| **Arte / vista** | **Top-down, más grande y detallado**: mismo ángulo cenital ligero, sprites 80px, más detalle/sombreado. |
| **Alcance** | **Council primero** al 100% (assets + movimiento + animaciones); luego replicar el patrón en Dev Team y Second Brain. |

Decisión de arquitectura asociada: **[ADR-0011](adr/0011-sistema-de-coreografia-de-escena.md)**
(sistema de coreografía de escena dirigido por eventos).

---

## 14.1 Principios

1. **La escena refleja el estado real** (regla de oro de doc 13 §13.2): cada paso, giro
   o acción de un personaje viene de un evento real de etapa/agente por SSE. Nunca
   movimiento decorativo o falso.
2. **Movimiento como traducción de eventos**, no como animación libre: el motor de
   escena traduce el contrato de eventos (`stage:start`, `agent:active`, `handoff`,
   `stage:done`, `session:done`, `mode:locked`) a **comandos de movimiento**.
3. **Tema reemplazable**: el escenario es un tema (`SceneTheme`), no la lógica. Cambiar
   de tema (mesa redonda → jurado, oficina → taller) no toca el pipeline ni el motor.
4. **Degradación elegante**: sin assets → placeholders; sin animación (por
   `prefers-reduced-motion`) → los personajes "teletransportan" a su destino sin walk,
   mostrando la pose de acción estática. La escena nunca bloquea la vista chat.
5. **Determinismo**: dada la misma secuencia de eventos, la coreografía es reproducible
   (sin aleatoriedad de posición; el único azar permitido es el de la anonimización del
   Council, que ya existe en la lógica).

---

## 14.2 Dirección de arte

| Parámetro | Valor v2 |
|-----------|----------|
| Vista | `low top-down` (cenital ligero ~20°), coherente en las tres escenas |
| Tamaño de personaje | **80 px** (canvas PixelLab ~112 px) — antes 48 px |
| Direcciones | **8** (S, SE, E, NE, N, NO, O, SO) para caminar en cualquier rumbo |
| Detalle / sombreado | `high detail` + `medium shading` (más cuerpo que la v1) |
| Contorno | `single color black outline` |
| Paleta por modo | Council teal+oro · Dev Team coral/amber · Second Brain púrpura |
| Consistencia | Todos los personajes de un modo comparten tamaño, vista y paleta; se generan en lote con descripciones paralelas (y, si hace falta, modo `v3`/`pro` para mayor coherencia) |

Los **fondos** se generan a la resolución de la escena (≈360×240) e incluyen el decorado
fijo (muros, escritorios, estanterías). Los **objetos dinámicos** (pergamino, libros,
taza) son sprites con fondo transparente que el motor coloca/anima según la etapa.

---

## 14.3 Modelo de espacio y movimiento

### 14.3.1 Sistema de coordenadas
La escena es un lienzo normalizado **0–100 en X e Y** (porcentaje), independiente de la
resolución de pantalla. Toda posición (waypoints, personajes, objetos) se expresa en ese
espacio. El render escala a píxeles del contenedor.

### 14.3.2 Waypoints y rutas
Cada tema define **waypoints** con nombre (puntos de interés) y, opcionalmente, un
**grafo de rutas** para evitar atravesar obstáculos (la mesa, los escritorios).

```ts
type Waypoint = { id: string; x: number; y: number; face?: Dir8 }
type Path = { from: string; to: string; via?: {x:number;y:number}[] }  // tramos rectos
```

Por defecto el motor va en **línea recta** de la posición actual al waypoint destino; si
el tema declara un `Path` con `via`, sigue esos puntos intermedios (p. ej. rodear la
mesa). Las **zonas no caminables** se modelan implícitamente con waypoints + `via`; no
hace falta polígono de colisión en v2.

### 14.3.3 Estado de movimiento del agente
```ts
type Dir8 = 'S'|'SE'|'E'|'NE'|'N'|'NW'|'W'|'SW'
type Motion = 'idle' | 'walk' | string  // string = acción del tema: 'talk','type','read','synthesize'
type AgentMotion = {
  pos: { x: number; y: number }   // posición actual (animada)
  dir: Dir8                       // hacia dónde mira
  motion: Motion
  target?: string                 // waypoint destino mientras camina
}
```

### 14.3.4 Coreografía (contrato)
Cada tema implementa una función **pura** que, dado el estado real de la sesión, devuelve
el **estado objetivo** de cada agente (a dónde debe ir, mirando a dónde, haciendo qué):

```ts
interface SceneTheme /* v2, ver §14.4 */ {
  choreography(state: SessionState): Record<AgentId, Target>
}
type Target = { at: string /*waypoint id*/, face?: Dir8, act?: Motion }
```

`SessionState` = `{ stage, busy, data, events }` (lo que ya recibe `InteractiveScene`).
El **motor** compara el objetivo con el estado actual y genera los comandos: si `at`
cambió → caminar (motion `walk`, dir = rumbo del tramo) hasta llegar, luego adoptar
`act`; si solo cambió `face`/`act` → girar/animar en el sitio.

### 14.3.5 Mapeo evento SSE → movimiento (común a los tres modos)
| Evento (doc 13 §13.2) | Efecto en la coreografía |
|------------------------|--------------------------|
| `stage:start(s)` | recalcula objetivos para la etapa `s` (posiciones de "set") |
| `agent:active(id)` | `id` camina a su **punto de acción** y reproduce su acción |
| `agent:waiting(id)` | `id` camina a su **punto de espera** y queda en `idle` |
| `handoff(a→b)` | `a` camina hacia `b` / a la zona de reunión; al llegar, `act` de entrega |
| `stage:done(s)` | objetivos de cierre de la etapa (p. ej. todos miran al centro) |
| `session:done` | coreografía final (entrega del resultado) |
| `mode:locked` | escena atenuada; sin movimiento |

### 14.3.6 Reproducción y timing
- **Tween de posición**: bucle `requestAnimationFrame`; velocidad de marcha constante
  (≈ **22 unidades/seg** en el espacio 0–100, ajustable por tema). Llegada cuando la
  distancia < ε.
- **Selección de frames**: mientras `walk`, el sprite usa la **tira direccional** del
  rumbo (8 opciones, se elige por el ángulo del vector velocidad) y avanza con `steps(n)`.
  Al llegar, conmuta a `idle` o a la tira de la acción.
- **Giro**: `face` sin desplazamiento solo cambia la dirección del sprite (frame estático
  de esa dirección) — no hay animación de giro en v2.
- **Encolado**: los objetivos se aplican en orden de evento; si llega uno nuevo mientras
  camina, se redirige al nuevo destino desde la posición actual (sin saltos).

### 14.3.7 Accesibilidad (NFR-INT-1)
Con `prefers-reduced-motion: reduce`: **sin tween ni walk cycle**; el personaje aparece
directamente en el waypoint destino con la pose de acción estática. La escena sigue
reflejando la etapa (posición + pose), solo que sin interpolar el movimiento.

---

## 14.4 Contrato `SceneTheme v2`

Extiende el de doc 13 §13.4 (no rompe `id`/`mode`/`detailFor`):

```ts
interface SceneTheme {
  id: string
  mode: 'council' | 'devteam' | 'brain'
  label: string

  agents: AgentDef[]                 // { id, name, tint, sprite slug }
  waypoints: Record<string, Waypoint>
  paths?: Path[]                     // rutas con puntos intermedios (rodear obstáculos)

  assets: SceneAssets                // §14.5.4: fondos, sprites por motion/dir, objetos

  // Posicionamiento + acción objetivo por agente, derivado del estado REAL:
  choreography(state: SessionState): Record<string, Target>

  // Objetos dinámicos visibles según la etapa (pergamino, libros, taza…):
  propsFor?(state: SessionState): PropPlacement[]

  // Detalle real al hacer clic en un personaje (igual que v1):
  detailFor(agentId: string, data: any): DetailCard
}
```

`poseFor` de la v1 desaparece: la pose pasa a ser el `act` que devuelve `choreography`,
y el motor decide walk/idle por la diferencia de posición.

---

## 14.5 Especificación de assets

### 14.5.1 Personaje
Por personaje:
- **Base 8 direcciones** (`create_character`, `n_directions: 8`, size 80, high detail).
- **Caminar**: animación `walk` (template), que cubre las **8 direcciones** (1 gen/dir).
- **Acción(es)** del rol: animación custom (v3) en la(s) dirección(es) que se usen
  (normalmente S, y la dirección en que actúa): Council caballero `talk`, rey
  `synthesize`; Dev Team `type`; Second Brain `search` / `read` / `deliver`.
- **Idle**: frame estático de la base, o animación `breathing-idle` si se quiere vida en
  reposo (opcional).

Coste estimado por personaje ≈ 1 (base) + 8 (walk) + 1–2 (acciones) ≈ **10–11 generaciones**.
Council (4 personajes) ≈ **40–45 generaciones** (de 2000 del plan).

### 14.5.2 Objetos / props
Sprites con fondo transparente (`create_map_object`): pergamino, taza de café, pila de
libros, vela, etc. Algunos pueden animarse (`animate_object`) si aportan (llama del
brasero, brillo del pergamino) — opcional.

### 14.5.3 Fondo / escenario
Una imagen de fondo por tema (≈360×240) con el decorado fijo. El fondo **no** contiene a
los personajes ni a los objetos dinámicos. Las zonas caminables se eligen al definir los
waypoints sobre ese fondo.

### 14.5.4 Convención de ficheros (glob-friendly)
Plano, para que `import.meta.glob` lo recoja sin estructura anidada:

```
assets/scenes/<theme-id>/
  background.png
  <slug>__idle__<dir>.png          # 8 ficheros (o 1 si solo S en reposo)
  <slug>__walk__<dir>.png          # 8 ficheros (tira horizontal de N frames)
  <slug>__<action>__<dir>.png      # acción, dir(s) usadas
  <object>.png                     # props
  theme.json                       # metadatos: frames por tira, fps, anclas
  MANIFEST.md + fetch.sh           # IDs PixelLab + descarga (egress)
```
`dir` ∈ {s,se,e,ne,n,nw,w,sw}. `theme.json` declara, por tira, `frames` y `fps` para que
el motor sepa cuántos pasos tiene cada `steps(n)`.

### 14.5.5 Pipeline PixelLab
1. `create_character` (8 dir, size 80, high detail) por personaje — en lote.
2. `animate_character` template `walk` (8 dir) por personaje.
3. `animate_character` v3 custom para la(s) acción(es).
4. `create_map_object` para fondo y props.
5. `fetch.sh` baja los frames y **ensambla las tiras** por dirección (ImageMagick
   `+append`), normalizando a un tamaño de frame fijo (p. ej. 72 px) → `steps(n)` exacto.
6. `theme.json` se rellena con `frames`/`fps` reales leídos del MCP.

> **Bloqueo de entorno conocido:** la descarga de bytes de PixelLab está bloqueada por la
> política de egress (403) en el entorno remoto. La generación y el cableado se hacen
> aquí; los binarios se bajan con `fetch.sh` desde una máquina con egress. El frontend
> cae a placeholders mientras tanto (mismo contrato).

---

## 14.6 Diseño por escena

### 14.6.1 Council — la mesa redonda *(referencia, se ejecuta primero)*

**Escenario:** salón medieval, mesa redonda al centro, 3 sillas de caballero alrededor y
un trono al fondo. La mesa es el obstáculo central (los personajes la rodean, no la
cruzan).

**Personajes:** Caballero A/B/C (modelos del council) + Rey (chairman).

**Waypoints (x,y en 0–100):**
| id | x | y | face | uso |
|----|---|---|------|-----|
| `seat_A` | 24 | 40 | E | silla A (reposo) |
| `seat_B` | 76 | 40 | W | silla B |
| `seat_C` | 30 | 78 | NE | silla C |
| `throne` | 50 | 16 | S | trono del rey (reposo) |
| `table_A` | 36 | 46 | E | borde de mesa frente a A (hablar) |
| `table_B` | 64 | 46 | W | borde de mesa frente a B |
| `table_C` | 42 | 64 | N | borde de mesa frente a C |
| `head` | 50 | 34 | S | cabecera de mesa (rey sintetiza) |

**Coreografía por etapa:**
| Etapa real (evento) | Movimiento |
|---------------------|------------|
| reposo / sin sesión | caballeros en `seat_*` (idle), rey en `throne` (idle) |
| `opinions` · `stage1_opinion(model)` | el caballero de ese modelo camina `seat→table_*`, `act:'talk'`; al terminar su opinión vuelve a `seat_*` (o se queda inclinado hasta el final de la etapa) |
| `review` | cada caballero en su `table_*` o `seat_*`, **gira** para "mirarse" (face hacia el centro); sin grandes desplazamientos (revisión anónima) |
| `synthesis` | el rey baja del `throne` a `head`, `act:'synthesize'` (alza la mano), glow dorado; los caballeros miran al rey (`face` N) |
| `done` · `session:done` | aparece `scroll` (prop) en el centro de la mesa; el rey vuelve al `throne` (o se queda en `head`) |
| `mode:locked` | salón atenuado, sin movimiento |

**Props dinámicos:** `scroll` (pergamino) visible solo en `done`.
**Acciones de personaje:** caballero `talk` (S y dirección a mesa), rey `synthesize` (S).

### 14.6.2 Dev Team — la oficina *(esbozo; se detalla al replicar)*

**Escenario:** oficina diáfana con 4 escritorios, una sala de reuniones y una cafetera.
**Personajes:** Arquitecto, Programador, Revisor, Tester.
**Waypoints:** `desk_<rol>` (acción `type` en el sitio), `meeting` (zona central de
reunión), `coffee` (punto de espera).
**Coreografía:**
| Evento | Movimiento |
|--------|------------|
| `agent:active(rol)` | el rol camina a su `desk_<rol>`, `act:'type'` (pantalla parpadea) |
| `agent:waiting(rol)` | el rol camina a `coffee`, `idle` |
| `handoff(a→b)` | `a` y `b` caminan a `meeting`, breve `act` de conversación; luego `b` a su `desk` |
| retorno tester→programador (loop_back) | el tester camina de `desk_tester` a `desk_programmer` y vuelve |
| `mode:locked` | luces apagadas, escritorios vacíos |

### 14.6.3 Second Brain — la biblioteca *(esbozo; se detalla al replicar)*

**Escenario:** biblioteca con estanterías en las paredes, mesas de lectura y un mostrador.
**Personaje:** Bibliotecario.
**Waypoints:** `shelves_1..n` (estanterías), `reading_table` (mesa), `counter` (mostrador),
`home` (reposo).
**Coreografía:**
| Etapa | Movimiento |
|-------|------------|
| `retrieval` | el bibliotecario recorre `shelves_*` (un tramo por nota recuperada), `act:'search'`; aparece un prop `books` por cada nota |
| `synthesis` | va a `reading_table`, `act:'read'` |
| `done` | lleva los libros al `counter`, `act:'deliver'` (respuesta + fuentes) |
| `mode:locked` | biblioteca cerrada |

---

## 14.7 Plan de ejecución por fases

> Council **primero y completo**; las otras dos replican el patrón ya validado.

- **F-S0 · Motor de escena (código).** Implementar en el frontend: tween de posición
  (rAF), selección de tira por dirección/motion, ejecución de `choreography`, soporte
  `prefers-reduced-motion`, fallback a placeholders. Contrato `SceneTheme v2` en
  `scenes.js`. *(No depende de assets; se prueba con placeholders/rectángulos que se
  desplazan.)*
- **F-S1 · Council assets.** Generar con PixelLab: 4 personajes 8-dir (80px, detallados),
  walk×8 por personaje, acciones (`talk`, `synthesize`), fondo del salón y `scroll`.
  Ensamblar tiras con `fetch.sh`, rellenar `theme.json`.
- **F-S2 · Council integración + pulido.** Cablear waypoints/coreografía reales; ajustar
  velocidades, rutas (rodear la mesa), timing y paleta hasta que **al usuario le guste**.
- **F-S3 · Replicar.** Repetir F-S1/F-S2 para Dev Team (oficina) y Second Brain
  (biblioteca) con sus waypoints y coreografías (§14.6.2/§14.6.3).

**Definition of Done (por escena):** la escena refleja el pipeline real con personajes que
**caminan** entre posiciones según los eventos; clic en personaje → contenido real;
`prefers-reduced-motion` degrada sin romper; build verde; assets bajables con `fetch.sh`.

---

## 14.8 Requisitos derivados

| ID | Requisito |
|----|-----------|
| FR-SCN-1 | Los personajes se desplazan entre waypoints; cada desplazamiento se dispara por un evento real de etapa/agente (no movimiento decorativo). |
| FR-SCN-2 | El sprite usa la dirección (8) correspondiente al rumbo de marcha y la acción al llegar. |
| FR-SCN-3 | La coreografía es una función pura del estado de sesión; cambiar de tema no toca el pipeline. |
| FR-SCN-4 | Los objetos dinámicos (pergamino, libros, taza) aparecen según la etapa real. |
| FR-SCN-5 | Clic en un personaje muestra su contenido real (hereda FR-INT-3). |
| NFR-SCN-1 | `prefers-reduced-motion`: sin tween ni walk; posición + pose estática (hereda NFR-INT-1). |
| NFR-SCN-2 | Degradación: sin assets → placeholders con el mismo contrato; la escena nunca bloquea el chat. |
| CON-SCN-1 | Assets generados con PixelLab (hereda CON-INT-1, ADR-0007); descarga sujeta a egress. |

Trazabilidad: extiende FR-INT-1..6 / NFR-INT-1..2 de doc 13 §13.7.

---

## 14.9 Riesgos y decisiones abiertas

- **Coste de assets**: 8 direcciones + walk por personaje multiplica las generaciones
  (~40–45 por escena). Mitigación: lote, y empezar por Council para validar antes de
  gastar en las otras dos.
- **Coherencia de estilo entre 8 direcciones**: si `standard` no basta, escalar a `v3`
  (8-dir, mayor calidad) para los personajes clave.
- **Rutas alrededor de obstáculos**: v2 usa tramos rectos + `via` manual. Si una escena
  necesita evitar muchos obstáculos, valorar un grafo de navegación (fuera de v2).
- **Egress de PixelLab**: la descarga sigue bloqueada en el entorno remoto; el flujo
  asume `fetch.sh` en local. No es un riesgo de diseño, sí de operación.
- **Abierto**: ¿idle "vivo" (`breathing-idle`) o estático? ¿el rey vuelve al trono en
  `done` o se queda en la cabecera? Se decide al pulir Council (F-S2) con el usuario.
