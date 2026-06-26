import { stageLabel } from '../theme.js'

// Barra de progreso por ETAPAS (nunca ETA por tiempo). Refleja el estado real
// que llega por SSE: etapas hechas, etapa actual, etapas pendientes.
export default function StageProgress({ stages, done, current }) {
  return (
    <div className="stage-progress" aria-label="Progreso por etapas">
      {stages.map((s) => {
        const isDone = done.includes(s)
        const isCurrent = s === current
        const state = isDone ? 'done' : isCurrent ? 'current' : 'pending'
        return (
          <div key={s} className={`stage seg-${state}`}>
            <span className="stage-bar" />
            <span className="stage-name">
              {stageLabel(s)}
              {isCurrent && <span className="stage-spinner" aria-hidden> ●</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
