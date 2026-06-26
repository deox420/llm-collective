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

// ---- Council: mesa redonda (3 caballeros A/B/C + rey chairman) -------------
const council = {
  id: 'council-round-table',
  mode: 'council',
  label: 'La mesa redonda',
  centerLabel: 'Rey',
  agents: [
    { id: 'A', kind: 'knight', name: 'Caballero A', tint: '#3b82c4' },
    { id: 'B', kind: 'knight', name: 'Caballero B', tint: '#e0673c' },
    { id: 'C', kind: 'knight', name: 'Caballero C', tint: '#3f9a6a' },
    { id: 'king', kind: 'king', name: 'Rey · chairman', tint: '#e8b923' },
  ],
  // posiciones (% del lienzo) alrededor de la mesa
  layout() {
    return {
      A: { x: 26, y: 32 },
      B: { x: 74, y: 32 },
      C: { x: 26, y: 70 },
      king: { x: 74, y: 70 },
    }
  },
  poseFor(agentId, { stage, busy, data }) {
    if (!busy && !data?.final) return POSE.IDLE
    const opinions = data?.opinions || []
    if (agentId === 'king') {
      if (stage === 'synthesis' || data?.final) return data?.final ? POSE.DONE : POSE.ACTIVE
      return POSE.WAIT
    }
    const idx = { A: 0, B: 1, C: 2 }[agentId]
    if (stage === 'opinions') return idx < opinions.length ? POSE.DONE : POSE.TALK
    if (stage === 'review') return POSE.ACTIVE
    if (stage === 'synthesis') return POSE.DONE
    return opinions[idx] ? POSE.DONE : POSE.IDLE
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
