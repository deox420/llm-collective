import { MODES } from '../theme.js'
import StageProgress from './StageProgress.jsx'

// Vista Chat de un modo. En Fase 2 es el shell: lanzar el flujo (demo), ver la
// barra por etapas en vivo y el historial. El contenido real llega en Fase 3+.
export default function ChatView({ mode, history, busy, onRun }) {
  const md = MODES[mode]
  const busyHere = busy?.mode === mode
  const busyElsewhere = busy && busy.mode !== mode
  const blockedBy = busyElsewhere ? MODES[busy.mode]?.label : null

  return (
    <div className="chatview">
      {busyElsewhere && (
        <div className="blocked-banner" role="status">
          🔒 {blockedBy} está trabajando. Solo un modo activo a la vez.
        </div>
      )}

      {busyHere && (
        <div className="running-panel">
          <p className="running-label">{md.label} trabajando…</p>
          <StageProgress stages={busy.stages} done={busy.done} current={busy.current} />
        </div>
      )}

      {!busyHere && history.length === 0 && (
        <div className="empty">
          <p className="empty-lead">{md.label}</p>
          <p className="empty-sub">Lanza una consulta para ver el flujo por etapas.</p>
        </div>
      )}

      <ul className="thread">
        {history.map((c) => (
          <li key={c.id} className="thread-item">
            <span className="thread-title">{c.title}</span>
            <span className="thread-stages">{c.stages.join(' → ')}</span>
          </li>
        ))}
      </ul>

      <div className="composer">
        <button
          className="run-btn"
          onClick={onRun}
          disabled={!!busy}
          title={busyElsewhere ? `${blockedBy} está trabajando` : 'Lanzar consulta demo'}
        >
          {busyHere ? 'En curso…' : busyElsewhere ? `Bloqueado por ${blockedBy}` : 'Lanzar consulta demo'}
        </button>
      </div>
    </div>
  )
}
