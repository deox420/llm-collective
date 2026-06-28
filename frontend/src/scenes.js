// scenes.js — implementaciones del contrato SceneTheme (13-interactive-scenes §13.4).
//
// Un tema define, SIN tocar la lógica: qué agentes hay, dónde se colocan (layout),
// qué pose tiene cada uno en cada etapa (poseFor) y qué detalle real mostrar al
// hacer clic (detailFor). Aquí los sprites son PLACEHOLDERS dibujados con DOM/CSS;
// cuando existan los assets de PixelLab (ASSETS.md), solo cambia `assets` y el
// dibujo, no este contrato.
//
// Regla de oro (§13.2): cada pose viene de un evento REAL de etapa/agente.

const POSE = { IDLE: 'idle', ACTIVE: 'active', TALK: 'talk', WAIT: 'wait', DONE: 'done', DIM: 'dim' }

// ---- Assets pixel-art de PixelLab (ASSETS.md, §13.5) ----------------------
// Los PNGs canónicos viven en assets/scenes/<theme>/ (raíz del repo). Se cargan
// con import.meta.glob de forma PEREZOSA-TOLERANTE: si los binarios aún no están
// (bloqueo de egress de PixelLab en el entorno), el mapa queda vacío y la escena
// cae a los placeholders DOM/CSS con el MISMO contrato. Soltar los PNGs en la
// carpeta hace que la escena los use sin tocar más código (§13.5).
const councilFiles = import.meta.glob(
  '../../assets/scenes/council-round-table/*.png',
  { eager: true, query: '?url', import: 'default' }
)
const devteamFiles = import.meta.glob(
  '../../assets/scenes/devteam-office/*.png',
  { eager: true, query: '?url', import: 'default' }
)
const brainFiles = import.meta.glob(
  '../../assets/scenes/brain-library/*.png',
  { eager: true, query: '?url', import: 'default' }
)
function pick(files, name) {
  const hit = Object.entries(files).find(([p]) => p.endsWith('/' + name))
  return hit ? hit[1] : null
}
function councilAsset(name) { return pick(councilFiles, name) }
function devteamAsset(name) { return pick(devteamFiles, name) }
function brainAsset(name) { return pick(brainFiles, name) }

// Tiras de animación de un dev: caminar (4 cardinales) + acciones (teclear, charlar).
// Nombres: <slug>.walk-{s,e,n,w}.png, <slug>.type.png, <slug>.talk.png.
function dtAnim(slug) {
  const walk = {}
  for (const d of ['S', 'E', 'N', 'W']) walk[d] = devteamAsset(`${slug}.walk-${d.toLowerCase()}.png`)
  return { walk, type: devteamAsset(`${slug}.type.png`), talk: devteamAsset(`${slug}.talk.png`) }
}

// Tiras del bibliotecario: caminar (4 cardinales) + acciones (buscar, leer, entregar).
// Nombres: librarian.walk-{s,e,n,w}.png, librarian.search.png, librarian.read.png,
// librarian.deliver.png. Si falta un PNG → placeholder con el mismo contrato.
function brainAnim() {
  const walk = {}
  for (const d of ['S', 'E', 'N', 'W']) walk[d] = brainAsset(`librarian.walk-${d.toLowerCase()}.png`)
  return {
    walk,
    search: brainAsset('librarian.search.png'),
    read: brainAsset('librarian.read.png'),
    deliver: brainAsset('librarian.deliver.png'),
  }
}

// ---- Council v2: mesa redonda, movimiento mínimo sentado (SDD §14.6.1) -----
// Contrato SceneTheme v2: cada agente tiene asiento + orientación fijos; choreography
// deriva la ACCIÓN de cada uno del estado REAL (sit_idle/writing/stand_present/vote/
// stand_verdict) y propsFor coloca los pergaminos. No caminan (sentados). El motor
// (InteractiveScene) anima sentarse↔levantarse y respeta prefers-reduced-motion.
// Posiciones de los PIES de cada personaje (sprite anclado abajo) al borde de la mesa.
const COUNCIL_SEATS = {
  king: { x: 50, y: 50, face: 'S' }, // cabecera (lado lejano), de frente a la mesa
  A:    { x: 30, y: 66, face: 'E' }, // al filo izquierdo, un pelín atrás; la mesa le tapa los pies
  B:    { x: 70, y: 66, face: 'W' }, // al filo derecho
  C:    { x: 50, y: 89, face: 'N' }, // borde cercano (delante), pies justo bajo la mesa
}
const council = {
  id: 'council-round-table',
  mode: 'council',
  label: 'La mesa redonda',
  // Assets v2 (SDD §14.6.1). Todos opcionales: si falta el PNG (egress), el motor
  // cae a placeholder. Sprite por personaje en su dirección de asiento; tira de
  // animación por acción; mesa + pergaminos + fondo del salón. fetch.sh los baja.
  assets: {
    background: councilAsset('background.png'),
    table: councilAsset('table.png'),
    tablePos: { x: 50, y: 64, w: 46 },
    scrolls: { scroll_blank: councilAsset('scroll-blank.png'), scroll_verdict: councilAsset('scroll-verdict.png') },
    sprites: {
      king: councilAsset('king.png'),
      A: councilAsset('knight-a.png'),
      B: councilAsset('knight-b.png'),
      C: councilAsset('knight-c.png'),
    },
    anim: {
      A: { writing: councilAsset('knight-a.writing.png'), stand_present: councilAsset('knight-a.present.png') },
      B: { writing: councilAsset('knight-b.writing.png'), stand_present: councilAsset('knight-b.present.png') },
      C: { writing: councilAsset('knight-c.writing.png'), stand_present: councilAsset('knight-c.present.png') },
      king: { stand_verdict: councilAsset('king.verdict.png') },
    },
    animFrames: 6,
  },
  agents: [
    { id: 'king', kind: 'king', name: 'Rey · chairman', tint: '#e8b923', ...COUNCIL_SEATS.king },
    { id: 'A', kind: 'knight', name: 'Caballero A', tint: '#3b82c4', ...COUNCIL_SEATS.A },
    { id: 'B', kind: 'knight', name: 'Caballero B', tint: '#e0673c', ...COUNCIL_SEATS.B },
    { id: 'C', kind: 'knight', name: 'Caballero C', tint: '#3f9a6a', ...COUNCIL_SEATS.C },
  ],
  // Acción objetivo de cada agente según el estado REAL (regla de oro §13.2):
  //   opinions → el que aún no ha opinado ESCRIBE; el que ya, se levanta a PRESENTAR.
  //   review   → todos de pie VOTANDO. synthesis/final → el rey da el VEREDICTO.
  choreography({ stage, working, data }) {
    const opinions = data?.opinions || []
    const final = data?.final
    const live = working || final
    const idxOf = { A: 0, B: 1, C: 2 }
    const out = {
      king: { at: COUNCIL_SEATS.king, face: 'S', act: (stage === 'synthesis' || final) ? 'stand_verdict' : 'sit_idle' },
    }
    for (const id of ['A', 'B', 'C']) {
      let act = 'sit_idle'
      if (live) {
        if (stage === 'opinions') act = opinions[idxOf[id]] ? 'stand_present' : 'writing'
        else if (stage === 'review') act = 'vote'
        else if (stage === 'synthesis' || final) act = 'stand_present'
      }
      out[id] = { at: COUNCIL_SEATS[id], face: COUNCIL_SEATS[id].face, act }
    }
    return out
  },
  // Pergamino en blanco frente a cada caballero (opinions/review) y pergamino del
  // veredicto al centro (final).
  propsFor({ stage, working, data }) {
    const final = data?.final
    const props = []
    const blanks = { A: { x: 37, y: 62 }, B: { x: 63, y: 62 }, C: { x: 50, y: 72 } }
    if (working && (stage === 'opinions' || stage === 'review') && !final) {
      for (const id of ['A', 'B', 'C']) props.push({ id: `scroll_${id}`, kind: 'scroll_blank', ...blanks[id] })
    }
    if (final) props.push({ id: 'scroll_verdict', kind: 'scroll_verdict', x: 50, y: 62 })
    return props
  },
  detailFor(agentId, data) {
    if (agentId === 'king') {
      return { title: 'Rey · chairman', body: data?.final || 'Aún no ha sintetizado.' }
    }
    const idx = { A: 0, B: 1, C: 2 }[agentId]
    const op = (data?.opinions || [])[idx]
    return { title: `Caballero ${agentId}${op ? ' · ' + op.model : ''}`, body: op?.content || 'Aún no ha opinado.' }
  },
}

// ---- Dev Team v2: la oficina, personajes que CAMINAN (SDD §14.6.2) ---------
// Tres zonas: sala de reuniones (izquierda), descanso+café (centro), estaciones
// (derecha). El motor (locomotion:'walk') interpola la posición y elige el ciclo
// de marcha por dirección; al llegar, la ACCIÓN (type/talk/present). Coreografía:
//  - reposo: los 4 en el café, charlando.
//  - architect (diseño) y entrega: los 4 a la reunión (se juntan).
//  - programmer/tester (código/pruebas): el activo a su estación (teclea); resto al café.
//  - reviewer (revisión): el revisor a la reunión; resto al café.
// Waypoints (pies) ajustados al fondo de oficina: mesa de reuniones a la IZQUIERDA,
// sofá/café al CENTRO-arriba, fila de escritorios ABAJO/derecha.
const DT = {
  meeting: { architect: { x: 11, y: 44 }, programmer: { x: 24, y: 44 }, reviewer: { x: 11, y: 60 }, tester: { x: 24, y: 60 } },
  break:   { architect: { x: 42, y: 54 }, programmer: { x: 54, y: 54 }, reviewer: { x: 46, y: 60 }, tester: { x: 58, y: 60 } },
  desk:    { architect: { x: 40, y: 73 }, programmer: { x: 52, y: 73 }, reviewer: { x: 78, y: 73 }, tester: { x: 65, y: 73 } },
}
const DT_DESK_ROLE = { programmer: true, tester: true }  // trabajan en su estación; arquitecto/revisor en reuniones
const DT_IDS = ['architect', 'programmer', 'reviewer', 'tester']
const devteam = {
  id: 'devteam-office',
  mode: 'devteam',
  label: 'La oficina',
  locomotion: 'walk',
  assets: {
    background: devteamAsset('background.png'),
    sprites: {
      architect: devteamAsset('architect.png'), programmer: devteamAsset('programmer.png'),
      reviewer: devteamAsset('reviewer.png'), tester: devteamAsset('tester.png'),
    },
    // anim[id] = { walk: {S,E,N,W,…}, type, talk } (tiras). Si faltan → placeholder.
    anim: {
      architect: dtAnim('architect'), programmer: dtAnim('programmer'),
      reviewer: dtAnim('reviewer'), tester: dtAnim('tester'),
    },
    animFrames: 6,
  },
  agents: [
    { id: 'architect', kind: 'dev', name: 'Arquitecto', tint: '#3b82c4' },
    { id: 'programmer', kind: 'dev', name: 'Programador', tint: '#e0673c' },
    { id: 'reviewer', kind: 'dev', name: 'Revisor', tint: '#8156d6' },
    { id: 'tester', kind: 'dev', name: 'Tester', tint: '#3f9a6a' },
  ],
  // Destino + acción de cada agente según la etapa REAL (rol activo = busy.current).
  choreography({ stage, working, data }) {
    const delivered = !!(data && (data.final || (data.files && data.files.length)))
    const gather = stage === 'architect' || delivered  // los 4 a la reunión
    const out = {}
    for (const id of DT_IDS) {
      let at, act, face
      if (gather) {
        at = DT.meeting[id]; act = 'talk'; face = 'S'               // los 4 en la reunión, hablando
      } else if (working && stage === id) {
        if (DT_DESK_ROLE[id]) { at = DT.desk[id]; act = 'type'; face = 'N' }
        else { at = DT.meeting[id]; act = 'talk'; face = 'S' }      // revisor en reuniones
      } else {
        at = DT.break[id]; act = 'talk'; face = 'S'                 // sin tarea → café, charlando
      }
      out[id] = { at, act, face }
    }
    return out
  },
  detailFor(agentId, data) {
    const map = {
      architect: data?.plan, programmer: data?.code, reviewer: data?.review,
      tester: (data?.tests || []).map((t) => `iter ${t.iteration}: ${t.passed ? 'OK' : 'falla'} · ${t.summary}`).join('\n'),
    }
    const names = { architect: 'Arquitecto', programmer: 'Programador', reviewer: 'Revisor', tester: 'Tester' }
    return { title: names[agentId], body: map[agentId] || 'En espera…' }
  },
}

// ---- Second Brain v2: la biblioteca, el bibliotecario CAMINA (SDD §14.6.3) --
// Zonas abiertas (composite: suelo vacío + muebles como objetos): ESTANTERÍAS al
// fondo, MESA DE LECTURA al centro, MOSTRADOR al frente. El bibliotecario CAMINA
// entre ellas según la etapa REAL (locomotion:'walk', motor §14.3.6):
//   reposo / sin consulta → en el mostrador, tranquilo (idle).
//   retrieval → va a las ESTANTERÍAS y busca (search, mira al fondo); por cada
//               nota recuperada aparece un libro (propsFor).
//   synthesis → va a la MESA DE LECTURA y lee (read, mira al frente).
//   done (answer listo) → vuelve al MOSTRADOR y entrega (deliver) + citas.
// Waypoints = posición de los PIES (sprite anclado abajo); z-index por y (los
// muebles, decor z0, quedan siempre detrás del personaje, que se planta ANTE ellos).
const BRAIN_WP = {
  counter: { x: 50, y: 82 },  // tras el mostrador de circulación (reposo/entrega), mira al frente (S)
  shelves: { x: 34, y: 38 },  // ante las estanterías EMPOTRADAS del muro del fondo, mira al fondo (N)
  reading: { x: 50, y: 67 },  // ante la mesa de lectura, mira al frente (S)
}
const brain = {
  id: 'brain-library',
  mode: 'brain',
  label: 'La biblioteca',
  locomotion: 'walk',
  assets: {
    background: brainAsset('background.png'),
    sprites: { librarian: brainAsset('librarian.png') },
    // anim.librarian = { walk:{S,E,N,W}, search, read, deliver } (tiras 6×). Si
    // faltan los PNG → placeholder que igualmente camina/actúa.
    anim: { librarian: brainAnim() },
    animFrames: 6,
    // props dinámicos (libro por nota recuperada); InteractiveScene los pinta.
    props: { book: brainAsset('book.png') },
    // mobiliario fijo (composite): estanterías al fondo, mesa al centro, mostrador
    // al frente, lámpara y planta de ambiente. x/y = CENTRO del objeto, w = % ancho.
    // Mobiliario grand-classic. Estanterías EMPOTRADAS en el muro del fondo (parte del
    // fondo). En el SUELO, todo CENITAL (visto desde arriba) para casar con el suelo:
    // mesa de lectura (centro) y mostrador de circulación (frente) vistos en planta, y
    // como ambiente piezas planas propias de biblioteca (globo, pila de libros/rollos)
    // que se leen bien desde arriba. z por y.
    decor: [
      { id: 'table', src: brainAsset('reading-table.png'), x: 50, y: 55, w: 20 },
      { id: 'counter', src: brainAsset('counter.png'), x: 50, y: 85, w: 28 },
      { id: 'globe', src: brainAsset('globe.png'), x: 13, y: 62, w: 8 },
      { id: 'pile', src: brainAsset('pile.png'), x: 84, y: 68, w: 9 },
    ],
  },
  agents: [
    { id: 'librarian', kind: 'librarian', name: 'Bibliotecario', tint: '#8156d6' },
  ],
  // Destino + acción del bibliotecario según la etapa REAL (regla de oro §13.2).
  choreography({ stage, working, data }) {
    const answered = !!(data && data.answer)
    let at = BRAIN_WP.counter, act = 'idle', face = 'S'
    if (working && stage === 'retrieval') { at = BRAIN_WP.shelves; act = 'search'; face = 'N' }
    else if (working && stage === 'synthesis') { at = BRAIN_WP.reading; act = 'read'; face = 'S' }
    else if (answered) { at = BRAIN_WP.counter; act = 'deliver'; face = 'S' }
    return { librarian: { at, face, act } }
  },
  // Un libro por nota recuperada; siguen al bibliotecario por su flujo de trabajo
  // (estantería → mesa → mostrador). Tope 6 (= TOP_K) para no saturar la escena.
  propsFor({ stage, working, data }) {
    const notes = (data && (data.retrieved || data.notes)) || []
    const answered = !!(data && data.answer)
    let base = null
    if (working && stage === 'retrieval') base = { x: 44, y: 42, dx: 3.6, row: 3 } // apilados junto al bibliotecario, ante el muro de estanterías
    else if (working && stage === 'synthesis') base = { x: 31, y: 61, dx: 3.6, row: 3 } // junto a la mesa de lectura
    else if (answered) base = { x: 36, y: 79, dx: 4, row: 6, z: 95 } // sobre el mostrador (citas entregadas, delante)
    if (!base) return []
    const n = Math.min(notes.length, 6)
    const props = []
    for (let i = 0; i < n; i++) {
      props.push({ id: `book-${i}`, kind: 'book', x: base.x + (i % base.row) * base.dx, y: base.y + Math.floor(i / base.row) * 4, z: base.z })
    }
    return props
  },
  detailFor(_agentId, data) {
    const list = data?.retrieved || data?.citations || []
    const notes = list.map((n) => `• ${n.note_path || n.path || n}`).join('\n')
    const answer = data?.answer
      || (data && (data.retrieved || data.notes)?.length ? 'Buscando en las notas…' : 'En reposo. Lanza una consulta para que el bibliotecario busque en el vault.')
    return { title: 'Bibliotecario', body: answer + (notes ? `\n\nNotas:\n${notes}` : '') }
  },
}

export const SCENE_THEMES = { council, devteam, brain }
export { POSE }
