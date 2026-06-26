// Paletas por contexto (12-frontend.md §12.2). El acento del modo tiñe TODA la
// pestaña vía variables CSS; el cambio es total con cross-fade de 200-300 ms.
export const MODES = {
  hub: { key: 'hub', label: 'Hub', icon: '◆', accent: '#6366f1', accentSoft: '#a5b4fc' },
  council: { key: 'council', label: 'Council', icon: '🏛', accent: '#14b8a6', accentSoft: '#5eead4' },
  devteam: { key: 'devteam', label: 'Dev Team', icon: '🛠', accent: '#f97316', accentSoft: '#fdba74' },
  brain: { key: 'brain', label: 'Second Brain', icon: '🧠', accent: '#a855f7', accentSoft: '#d8b4fe' },
}

// Orden de los modos (carpetas del sidebar). Hub va aparte, arriba.
export const MODE_ORDER = ['council', 'devteam', 'brain']

// Etiquetas legibles de etapa por modo (progreso por ETAPAS, nunca ETA).
export const STAGE_LABELS = {
  opinions: 'Opiniones',
  review: 'Revisión',
  synthesis: 'Síntesis',
  architect: 'Arquitecto',
  programmer: 'Programador',
  reviewer: 'Revisor',
  tester: 'Tester',
  retrieval: 'Recuperación',
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage
}
