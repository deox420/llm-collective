// Paletas por contexto (diseño Claude Design). El acento del modo tiñe toda la
// pestaña vía variables CSS animables; el cambio es total con cross-fade.
export const ACCENTS = { hub: '#5b5bd6', council: '#0f9e90', devteam: '#e0673c', brain: '#8156d6' }
export const ACCENT_RGB = {
  hub: [91, 91, 214], council: [15, 158, 144], devteam: [224, 103, 60], brain: [129, 86, 214],
}

export const MODE_ORDER = ['council', 'devteam', 'brain']

export const TITLES = { hub: 'Inicio', council: 'Council', devteam: 'Dev Team', brain: 'Second Brain' }
export const LANES = { council: '3× Ollama Cloud · GPU', devteam: 'pipeline · 4 roles', brain: 'local + túnel' }
export const COMPOSER_PLACEHOLDER = {
  council: 'Pregunta al consejo…', devteam: 'Describe una tarea de código…', brain: 'Pregunta a tus notas…',
}
export const COMPOSER_LANE = {
  council: '4 modelos · vía cloud', devteam: 'pipeline de roles · vía GPU', brain: 'búsqueda local · túnel seguro',
}

// Valores de tema claro/oscuro (se inyectan como variables CSS en el root).
export const THEME_VARS = {
  light: { '--bg': '#fafafb', '--surface': '#ffffff', '--surface-2': '#f4f4f6', '--text': '#1b1b20', '--text-dim': '#6c6c75', '--text-faint': '#a0a0a8', '--line': '#e9e9ec', '--line-2': '#dededf' },
  dark: { '--bg': '#151517', '--surface': '#1c1c1f', '--surface-2': '#26262b', '--text': '#ededf0', '--text-dim': '#9a9aa3', '--text-faint': '#67676f', '--line': '#2b2b30', '--line-2': '#3a3a40' },
}

// Etapas reales por modo (deben coincidir con el backend).
export const STAGES_BY_MODE = {
  council: ['opinions', 'review', 'synthesis'],
  devteam: ['architect', 'programmer', 'reviewer', 'tester'],
  brain: ['retrieval', 'synthesis'],
}
export const STAGE_LABELS = {
  opinions: 'Opiniones', review: 'Revisión', synthesis: 'Síntesis',
  architect: 'Arquitecto', programmer: 'Programador', reviewer: 'Revisor', tester: 'Tester',
  retrieval: 'Recuperación',
}
export const stageLabel = (s) => STAGE_LABELS[s] || s

// Historial de demostración por modo (placeholder; el real se va acumulando).
export const SAMPLE_HISTORY = {
  council: ['Cacheo local-first', 'Elección de vector DB', 'Prompt de evaluación'],
  devteam: ['Cola con reintentos', 'Migración a ESM', 'Fix de race condition'],
  brain: ['Esquema de sync', 'Notas de la reunión Q2', 'Ideas de arquitectura'],
}
