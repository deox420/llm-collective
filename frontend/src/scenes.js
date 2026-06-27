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

// ---- Council v2: mesa redonda, movimiento mínimo sentado (SDD §14.6.1) -----
// Contrato SceneTheme v2: cada agente tiene asiento + orientación fijos; choreography
// deriva la ACCIÓN de cada uno del estado REAL (sit_idle/writing/stand_present/vote/
// stand_verdict) y propsFor coloca los pergaminos. No caminan (sentados). El motor
// (InteractiveScene) anima sentarse↔levantarse y respeta prefers-reduced-motion.
const COUNCIL_SEATS = {
  king: { x: 50, y: 30, face: 'S' }, // trono a la cabecera, de frente a la mesa
  A:    { x: 25, y: 56, face: 'E' }, // izquierda, mira a la mesa
  B:    { x: 75, y: 56, face: 'W' }, // derecha, mira a la mesa
  C:    { x: 50, y: 78, face: 'N' }, // frente inferior, mira a la mesa (orientación estricta)
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
    tablePos: { x: 50, y: 60, w: 52 },
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
    const blanks = { A: { x: 34, y: 56 }, B: { x: 66, y: 56 }, C: { x: 50, y: 71 } }
    if (working && (stage === 'opinions' || stage === 'review') && !final) {
      for (const id of ['A', 'B', 'C']) props.push({ id: `scroll_${id}`, kind: 'scroll_blank', ...blanks[id] })
    }
    if (final) props.push({ id: 'scroll_verdict', kind: 'scroll_verdict', x: 50, y: 58 })
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

// ---- Dev Team: la oficina (4 roles) ---------------------------------------
const devteam = {
  id: 'devteam-office',
  mode: 'devteam',
  label: 'La oficina',
  centerLabel: 'Reunión',
  assets: {
    sprites: {
      architect: devteamAsset('architect.png'),
      programmer: devteamAsset('programmer.png'),
      reviewer: devteamAsset('reviewer.png'),
      tester: devteamAsset('tester.png'),
    },
    background: devteamAsset('background.png'),
    decor: [
      { id: 'coffee', src: devteamAsset('coffee.png'), x: 90, y: 84, w: 10 },
    ],
  },
  agents: [
    { id: 'architect', kind: 'dev', name: 'Arquitecto', tint: '#3b82c4' },
    { id: 'programmer', kind: 'dev', name: 'Programador', tint: '#e0673c' },
    { id: 'reviewer', kind: 'dev', name: 'Revisor', tint: '#8156d6' },
    { id: 'tester', kind: 'dev', name: 'Tester', tint: '#3f9a6a' },
  ],
  layout() {
    return {
      architect: { x: 22, y: 32 },
      programmer: { x: 50, y: 32 },
      reviewer: { x: 78, y: 32 },
      tester: { x: 50, y: 72 },
    }
  },
  poseFor(agentId, { busy }) {
    if (!busy) return POSE.IDLE
    if (busy.current === agentId) return POSE.ACTIVE
    if (busy.done?.includes(agentId)) return POSE.DONE
    return POSE.WAIT
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

// ---- Second Brain: la biblioteca (un bibliotecario) -----------------------
const brain = {
  id: 'brain-library',
  mode: 'brain',
  label: 'La biblioteca',
  centerLabel: 'Mostrador',
  assets: {
    sprites: { librarian: brainAsset('librarian.png') },
    background: brainAsset('background.png'),
    decor: [
      { id: 'books', src: brainAsset('books.png'), x: 28, y: 72, w: 12 },
      { id: 'candle', src: brainAsset('candle.png'), x: 72, y: 34, w: 7 },
    ],
  },
  agents: [
    { id: 'librarian', kind: 'librarian', name: 'Bibliotecario', tint: '#8156d6' },
  ],
  layout() {
    return { librarian: { x: 50, y: 50 } }
  },
  poseFor(agentId, { stage, busy, data }) {
    if (!busy && !data?.answer) return POSE.IDLE
    if (stage === 'retrieval') return POSE.ACTIVE
    if (stage === 'synthesis') return POSE.TALK
    return data?.answer ? POSE.DONE : POSE.IDLE
  },
  detailFor(_agentId, data) {
    const notes = (data?.retrieved || []).map((n) => `• ${n.note_path}`).join('\n')
    return { title: 'Bibliotecario', body: (data?.answer || 'Buscando…') + (notes ? `\n\nNotas:\n${notes}` : '') }
  },
}

export const SCENE_THEMES = { council, devteam, brain }
export { POSE }
