import { useState } from 'react'
import { MODES } from '../theme.js'
import StageProgress from './StageProgress.jsx'

// Vista Chat de Council (FR-C4, 12-frontend §12.6): respuesta del chairman +
// pestañas de opiniones + panel de revisión. Consume el SSE real del backend.
export default function CouncilChatView({ busy, result, error, history, onAsk }) {
  const md = MODES.council
  const [question, setQuestion] = useState('')
  const [tab, setTab] = useState(0)
  const busyHere = busy?.mode === 'council'
  const busyElsewhere = busy && busy.mode !== 'council'
  const blockedBy = busyElsewhere ? MODES[busy.mode]?.label : null

  const submit = (e) => {
    e.preventDefault()
    if (!question.trim() || busy) return
    onAsk(question.trim())
  }

  const opinions = result?.opinions || []
  const reviews = result?.reviews || []

  return (
    <div className="chatview">
      {busyElsewhere && (
        <div className="blocked-banner" role="status">
          🔒 {blockedBy} está trabajando. Solo un modo activo a la vez.
        </div>
      )}
      {error && <div className="blocked-banner" role="status">⚠️ {error}</div>}

      {busyHere && (
        <div className="running-panel">
          <p className="running-label">Council trabajando…</p>
          <StageProgress stages={busy.stages} done={busy.done} current={busy.current} />
        </div>
      )}

      {/* Respuesta del chairman (etapa 3) */}
      {result?.final && (
        <div className="chairman">
          <div className="chairman-head">🏛 Síntesis del chairman</div>
          <p className="chairman-body">{result.final}</p>
        </div>
      )}

      {/* Pestañas de opiniones (etapa 1) */}
      {opinions.length > 0 && (
        <div className="opinions">
          <div className="tabs" role="tablist">
            {opinions.map((o, i) => (
              <button
                key={o.model}
                role="tab"
                aria-selected={tab === i}
                className={tab === i ? 'active' : ''}
                onClick={() => setTab(i)}
              >
                Agente {i + 1}
              </button>
            ))}
          </div>
          <div className="tab-body">
            <div className="tab-model">{opinions[tab]?.model}</div>
            <p>{opinions[tab]?.content}</p>
          </div>
        </div>
      )}

      {/* Panel de revisión cruzada anonimizada (etapa 2) */}
      {reviews.length > 0 && (
        <div className="reviews">
          <div className="reviews-head">Revisión cruzada (anónima)</div>
          <ul>
            {reviews.map((r) => (
              <li key={r.reviewer}>
                <span className="reviewer">{r.reviewer}</span> →{' '}
                {(r.rankings || []).map((rk) => `${rk.candidate}:${rk.score}`).join('  ') || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!busyHere && !result?.final && history.length === 0 && (
        <div className="empty">
          <p className="empty-lead">{md.label}</p>
          <p className="empty-sub">Pregunta algo y varios modelos opinarán, se criticarán y el chairman sintetizará.</p>
        </div>
      )}

      <form className="composer council-composer" onSubmit={submit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={busyElsewhere ? `Bloqueado por ${blockedBy}` : 'Escribe tu pregunta al consejo…'}
          disabled={!!busy}
        />
        <button className="run-btn" type="submit" disabled={!!busy || !question.trim()}>
          {busyHere ? 'En curso…' : 'Preguntar'}
        </button>
      </form>
    </div>
  )
}
