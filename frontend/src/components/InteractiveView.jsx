import { MODES, stageLabel } from '../theme.js'

// Vista Interactiva (placeholder de Fase 2). Refleja el estado REAL del pipeline:
// cada "agente" de etapa se ilumina según los eventos SSE. Los sprites pixel-art
// de PixelLab llegan en la Fase 6 con el mismo contrato (13-interactive-scenes §13.5).
// La animación se desactiva con prefers-reduced-motion (ver styles.css).
export default function InteractiveView({ mode, busy, onRun }) {
  const md = MODES[mode]
  const busyHere = busy?.mode === mode
  const busyElsewhere = busy && busy.mode !== mode
  // Sin datos en vivo mostramos las etapas del modo en reposo.
  const stages = busyHere ? busy.stages : STAGES_BY_MODE[mode]
  const done = busyHere ? busy.done : []
  const current = busyHere ? busy.current : null

  return (
    <div className={`scene ${busyElsewhere ? 'scene-locked' : ''}`}>
      {busyElsewhere && (
        <div className="scene-lock-overlay">🔒 {MODES[busy.mode]?.label} está trabajando</div>
      )}
      <div className="scene-stage">
        {stages.map((s) => {
          const isDone = done.includes(s)
          const isCurrent = s === current
          return (
            <div
              key={s}
              className={`agent ${isDone ? 'agent-done' : ''} ${isCurrent ? 'agent-active' : ''}`}
            >
              <div className="agent-avatar">{md.icon}</div>
              <div className="agent-name">{stageLabel(s)}</div>
            </div>
          )
        })}
      </div>
      <div className="composer">
        <button className="run-btn" onClick={onRun} disabled={!!busy}>
          {busyHere ? 'En curso…' : busyElsewhere ? 'Bloqueado' : 'Lanzar consulta demo'}
        </button>
      </div>
    </div>
  )
}

const STAGES_BY_MODE = {
  council: ['opinions', 'review', 'synthesis'],
  devteam: ['architect', 'programmer', 'reviewer', 'tester'],
  brain: ['retrieval', 'synthesis'],
}
