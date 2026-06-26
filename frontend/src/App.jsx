import { useCallback, useEffect, useRef, useState } from 'react'
import { MODES } from './theme.js'
import { ModeBusyError, fetchHealth, runMode } from './api.js'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import ChatView from './components/ChatView.jsx'
import InteractiveView from './components/InteractiveView.jsx'

// Espejo de las etapas del backend (app.py DEMO_STAGES) para poder dibujar la
// barra por etapas desde el inicio del modo.
const DEMO_STAGES = {
  council: ['opinions', 'review', 'synthesis'],
  devteam: ['architect', 'programmer', 'reviewer', 'tester'],
  brain: ['retrieval', 'synthesis'],
}

export default function App() {
  const [selected, setSelected] = useState('hub')
  const [view, setView] = useState('chat') // 'chat' | 'interactive'
  const [busy, setBusy] = useState(null) // { mode, stages, done[], current }
  const [histories, setHistories] = useState({ council: [], devteam: [], brain: [] })
  const [notice, setNotice] = useState(null)
  const [health, setHealth] = useState(null)
  const busyRef = useRef(null)
  busyRef.current = busy

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  // Auto-descarta el aviso no bloqueante tras unos segundos.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(t)
  }, [notice])

  const startMode = useCallback(async (mode) => {
    if (busyRef.current) {
      const active = busyRef.current.mode
      setNotice(`${MODES[active]?.label || active} está trabajando…`)
      return
    }
    const stages = DEMO_STAGES[mode]
    setBusy({ mode, stages, done: [], current: null })
    try {
      await runMode(mode, {
        onEvent: ({ event, data }) => {
          if (event === 'stage:start') {
            setBusy((b) => (b ? { ...b, current: data.stage } : b))
          } else if (event === 'stage:done') {
            setBusy((b) =>
              b ? { ...b, done: [...b.done, data.stage], current: null } : b,
            )
          }
        },
      })
      setHistories((h) => ({
        ...h,
        [mode]: [
          { id: `${mode}-${h[mode].length + 1}`, title: `Consulta demo #${h[mode].length + 1}`, stages },
          ...h[mode],
        ],
      }))
    } catch (e) {
      if (e instanceof ModeBusyError) {
        setNotice(`${MODES[e.activeMode]?.label || e.activeMode} está trabajando…`)
      } else {
        setNotice('No se pudo ejecutar el modo (¿backend levantado?).')
      }
    } finally {
      setBusy(null)
    }
  }, [])

  const ctx = selected === 'hub' ? MODES.hub : MODES[selected]

  return (
    <div
      className="app"
      data-context={selected}
      style={{ '--accent': ctx.accent, '--accent-soft': ctx.accentSoft }}
    >
      <Sidebar
        selected={selected}
        onSelect={setSelected}
        histories={histories}
        busy={busy}
      />
      <main className="main">
        <Header
          context={ctx}
          selected={selected}
          view={view}
          onToggleView={setView}
          health={health}
          busy={busy}
        />
        {notice && <div className="notice" role="status">{notice}</div>}
        <section className="content">
          {selected === 'hub' ? (
            <Hub onEnter={setSelected} busy={busy} />
          ) : view === 'chat' ? (
            <ChatView
              mode={selected}
              history={histories[selected]}
              busy={busy}
              onRun={() => startMode(selected)}
            />
          ) : (
            <InteractiveView mode={selected} busy={busy} onRun={() => startMode(selected)} />
          )}
        </section>
      </main>
    </div>
  )
}

function Hub({ onEnter, busy }) {
  return (
    <div className="hub">
      <h1 className="hub-title">LLM Collective</h1>
      <p className="hub-sub">Un núcleo de orquestación, tres formas de pensar con varios modelos.</p>
      <div className="hub-cards">
        {['council', 'devteam', 'brain'].map((m) => {
          const md = MODES[m]
          const isBusy = busy?.mode === m
          return (
            <button key={m} className="hub-card" onClick={() => onEnter(m)}
              style={{ '--card-accent': md.accent }}>
              <span className="hub-card-icon">{md.icon}</span>
              <span className="hub-card-label">{md.label}</span>
              {isBusy && <span className="dot pulse" aria-label="ocupado" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
