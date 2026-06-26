import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ACCENTS, ACCENT_RGB, MODE_ORDER, TITLES, LANES, THEME_VARS,
  STAGES_BY_MODE, STAGE_LABELS, stageLabel, COMPOSER_PLACEHOLDER, COMPOSER_LANE, SAMPLE_HISTORY,
} from './theme.js'
import { ModeBusyError, createConversation, fetchHealth, runCouncilQuery, runMode } from './api.js'
import ParticleField from './ParticleField.jsx'
import { Icon } from './Icons.jsx'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif"
const MONO = "'IBM Plex Mono',monospace"

export default function App() {
  const [mode, setMode] = useState('hub')
  const [theme, setTheme] = useState('light')
  const [panelOpen, setPanelOpen] = useState(true)
  const [folders, setFolders] = useState({ council: true, devteam: false, brain: false })
  const [councilTab, setCouncilTab] = useState(0)
  const [busy, setBusy] = useState(null)        // {mode, stages, done[], current}
  const [toast, setToast] = useState(null)      // {mode}
  const [council, setCouncil] = useState(null)  // {opinions, reviews, final}
  const [councilError, setCouncilError] = useState(null)
  const [histories, setHistories] = useState({ council: [], devteam: [], brain: [] })
  const [composer, setComposer] = useState('')
  const [health, setHealth] = useState(null)
  const busyRef = useRef(null); busyRef.current = busy
  const toastTo = useRef(null)

  useEffect(() => { fetchHealth().then(setHealth).catch(() => {}) }, [])
  useEffect(() => () => clearTimeout(toastTo.current), [])

  const showToast = useCallback((m) => {
    clearTimeout(toastTo.current)
    setToast({ mode: m })
    toastTo.current = setTimeout(() => setToast(null), 5400)
  }, [])

  const accent = ACCENTS[mode]
  const accentRGB = ACCENT_RGB[mode]
  const working = !!(busy && busy.mode === mode)

  // ---- runners (conservan el wiring real) ----
  const startCouncil = useCallback(async (question) => {
    if (busyRef.current) { showToast(busyRef.current.mode); return }
    setCouncil({ opinions: [], reviews: [], final: null }); setCouncilError(null); setCouncilTab(0)
    setBusy({ mode: 'council', stages: STAGES_BY_MODE.council, done: [], current: null })
    try {
      const conv = await createConversation('council')
      await runCouncilQuery(conv.id, question, {
        onEvent: ({ event, data }) => {
          if (event === 'stage:start') setBusy((b) => b && { ...b, current: data.stage })
          else if (event === 'stage:done') setBusy((b) => b && { ...b, done: [...b.done, data.stage], current: null })
          else if (event === 'stage1_opinion') setCouncil((r) => ({ ...r, opinions: [...r.opinions, { model: data.model, content: data.content }] }))
          else if (event === 'stage2_review') setCouncil((r) => ({ ...r, reviews: [...r.reviews, data] }))
          else if (event === 'stage3_final') setCouncil((r) => ({ ...r, final: data.content }))
          else if (event === 'model_error') setCouncilError(`Modelo no disponible (${data.model || data.code}). ¿Acceso a Ollama Cloud?`)
        },
      })
      setHistories((h) => ({ ...h, council: [{ id: `c-${h.council.length + 1}`, title: question.slice(0, 42) }, ...h.council] }))
    } catch (e) {
      if (e instanceof ModeBusyError) showToast(e.activeMode || 'council')
      else setCouncilError('No se pudo completar la consulta (¿backend y modelos disponibles?).')
    } finally { setBusy(null) }
  }, [showToast])

  const startDemo = useCallback(async (m) => {
    if (busyRef.current) { showToast(busyRef.current.mode); return }
    setBusy({ mode: m, stages: STAGES_BY_MODE[m], done: [], current: null })
    try {
      await runMode(m, {
        onEvent: ({ event, data }) => {
          if (event === 'stage:start') setBusy((b) => b && { ...b, current: data.stage })
          else if (event === 'stage:done') setBusy((b) => b && { ...b, done: [...b.done, data.stage], current: null })
        },
      })
      setHistories((h) => ({ ...h, [m]: [{ id: `${m}-${h[m].length + 1}`, title: composer.trim().slice(0, 42) || `Consulta #${h[m].length + 1}` }, ...h[m]] }))
    } catch (e) {
      if (e instanceof ModeBusyError) showToast(e.activeMode || m)
    } finally { setBusy(null) }
  }, [showToast, composer])

  const selectMode = (m) => {
    if (busyRef.current && busyRef.current.mode !== m && m !== 'hub') {
      // entrar a un modo distinto al ocupado: avisa (no bloquea la navegación)
      if (busyRef.current.mode !== m) showToast(busyRef.current.mode)
    }
    setMode(m)
  }
  const onSubmit = () => {
    const text = composer.trim()
    if (!text || mode === 'hub') return
    if (busyRef.current) { showToast(busyRef.current.mode); return }
    setComposer('')
    if (mode === 'council') startCouncil(text)
    else startDemo(mode)
  }

  const rootStyle = {
    '--accent': accent, ...THEME_VARS[theme],
    transition: '--accent 280ms ease, --bg 240ms ease, --surface 240ms ease, --surface-2 240ms ease, --text 240ms ease, --text-dim 240ms ease, --line 240ms ease',
    display: 'flex', height: '100vh', width: '100%', overflow: 'hidden',
    background: 'var(--bg)', color: 'var(--text)', fontFamily: FONT, fontSize: 14,
    WebkitFontSmoothing: 'antialiased',
  }

  return (
    <div style={rootStyle}>
      <Sidebar
        mode={mode} folders={folders} busy={busy} histories={histories} theme={theme}
        onHub={() => setMode('hub')} onSelect={selectMode}
        onToggleFolder={(k) => setFolders((f) => ({ ...f, [k]: !f[k] }))}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <ParticleField accentRGB={accentRGB} working={working} />
        <Header
          mode={mode} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((p) => !p)}
          health={health}
        />
        {mode === 'hub' && <Hub busy={busy} onSelect={selectMode} />}
        {mode === 'council' && <CouncilView council={council} error={councilError} busy={busy} tab={councilTab} onTab={setCouncilTab} panelOpen={panelOpen} />}
        {mode === 'devteam' && <DevTeamView busy={busy} panelOpen={panelOpen} />}
        {mode === 'brain' && <BrainView busy={busy} panelOpen={panelOpen} accent={accent} />}
        {mode !== 'hub' && (
          <Composer
            mode={mode} value={composer} onChange={setComposer} onSubmit={onSubmit} disabled={!!busy}
          />
        )}
      </main>
      {toast && <Toast mode={toast.mode} busy={busy} onClose={() => setToast(null)} />}
    </div>
  )
}

/* ============================ SIDEBAR ============================ */
function Sidebar({ mode, folders, busy, histories, theme, onHub, onSelect, onToggleFolder, onToggleTheme }) {
  const folderRow = (key) => {
    const active = mode === key
    const color = ACCENTS[key]
    const style = {
      margin: '1px 0', padding: '7px 9px', borderRadius: 8, display: 'flex', alignItems: 'center',
      gap: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
      ...(active
        ? { background: `color-mix(in oklab,${color} 12%,var(--surface))`, color, fontWeight: 600 }
        : { color: 'var(--text)', fontWeight: 500 }),
    }
    const hist = histories[key].length ? histories[key].map((h) => h.title) : SAMPLE_HISTORY[key]
    const isBusy = busy?.mode === key
    return (
      <div key={key}>
        <div onClick={() => onSelect(key)} style={style} data-hover>
          <span onClick={(e) => { e.stopPropagation(); onToggleFolder(key) }}
            style={{ display: 'flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', transform: `rotate(${folders[key] ? 90 : 0}deg)`, transition: 'transform 160ms' }}>
            <Icon name="chevron" size={11} />
          </span>
          <Icon name={key} size={16} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{TITLES[key]}</span>
          {isBusy && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'llmc-pulse 1.3s ease-in-out infinite' }} />}
        </div>
        {folders[key] && (
          <div style={{ padding: '2px 0 6px 18px' }}>
            {hist.map((title, i) => (
              <div key={i} onClick={() => onSelect(key)} data-hover
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 12.5, color: mode === key && i === 0 ? ACCENTS[key] : 'var(--text-dim)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  const hubActive = mode === 'hub'
  return (
    <aside style={{ width: 240, flex: 'none', borderRight: '1px solid var(--line)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '18px 16px 16px' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 280ms' }}>
          <Icon name="logo" size={13} stroke="#fff" />
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em' }}>LLM Collective</div>
      </div>
      <div onClick={onHub} data-hover
        style={{ margin: '2px 8px 6px', padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: hubActive ? 'var(--accent)' : 'var(--text)', background: hubActive ? 'color-mix(in oklab,var(--accent) 12%,var(--surface))' : 'transparent', fontWeight: hubActive ? 600 : 500 }}>
        <Icon name="hub" size={16} /><span>Inicio</span>
      </div>
      <div style={{ padding: '10px 18px 6px', fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>Modos</div>
      <div data-scroll style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {MODE_ORDER.map(folderRow)}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div onClick={onToggleTheme} data-hover style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12.5, flex: 1 }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          <span>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
        </div>
      </div>
    </aside>
  )
}

/* ============================ HEADER ============================ */
function Header({ mode, panelOpen, onTogglePanel, health }) {
  const isHub = mode === 'hub'
  return (
    <header style={{ height: 54, flex: 'none', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{TITLES[mode]}</div>
        {!isHub && <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: MONO, whiteSpace: 'nowrap' }}>{LANES[mode]}</span>}
      </div>
      <div style={{ flex: 1 }} />
      {health && <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: MONO }}>perfil: {health.profile}</span>}
      {!isHub && (
        <div onClick={onTogglePanel} title="Panel" data-hover style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', color: panelOpen ? 'var(--accent)' : 'var(--text-faint)' }}>
          <Icon name="panel" size={17} />
        </div>
      )}
    </header>
  )
}

/* ============================ HUB ============================ */
function Hub({ busy, onSelect }) {
  const cards = [
    { key: 'council', title: 'Council', desc: 'Tres modelos deliberan, se evalúan entre sí y un chairman sintetiza la respuesta final.', lane: '3× Ollama Cloud · chairman en GPU' },
    { key: 'devteam', title: 'Dev Team', desc: 'Un pipeline de roles —arquitecto, programador, revisor, tester— construye y prueba el código.', lane: 'pipeline · 4 roles' },
    { key: 'brain', title: 'Second Brain', desc: 'Responde citando tus notas de Obsidian, con enlaces directos a cada fuente.', lane: 'recuperación local + síntesis' },
  ]
  return (
    <div data-scroll style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 28px 40px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, transition: 'color 280ms' }}>Local-first · multi-modelo</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.02em', fontWeight: 600, margin: '12px 0 8px' }}>Buenas tardes.</h1>
        <p style={{ fontSize: 15, color: 'var(--text-dim)', margin: '0 0 32px', maxWidth: 520, lineHeight: 1.55 }}>Elige un modo. Cada uno corre en su propia vía de cómputo; solo un modo trabaja a la vez para no saturar los recursos.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          {cards.map((c) => {
            const col = ACCENTS[c.key]; const isBusy = busy?.mode === c.key
            return (
              <div key={c.key} onClick={() => onSelect(c.key)} data-card
                style={{ position: 'relative', border: `1px solid ${isBusy ? `color-mix(in oklab,${col} 28%,var(--line))` : 'var(--line)'}`, borderRadius: 14, padding: 20, cursor: 'pointer', background: 'var(--surface)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab,${col} 12%,var(--surface))`, color: col }}>
                  <Icon name={c.key} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 3 }}>{c.title}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{c.desc}</div>
                  <div style={{ marginTop: 11, fontSize: 11, fontFamily: MONO, color: 'var(--text-faint)' }}>{c.lane}</div>
                </div>
                {isBusy
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: col, flex: 'none', alignSelf: 'center' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: col, animation: 'llmc-pulse 1.3s ease-in-out infinite' }} />trabajando</span>
                  : <span style={{ fontSize: 11, color: 'var(--text-faint)', flex: 'none', alignSelf: 'center' }}>listo</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ============================ COUNCIL ============================ */
const SECTION_LABEL = { fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }
const PANEL_STYLE = { width: 320, flex: 'none', borderLeft: '1px solid var(--line)', background: 'var(--surface)', height: '100%' }

function CouncilView({ council, error, busy, tab, onTab, panelOpen }) {
  const opinions = council?.opinions || []
  const reviews = council?.reviews || []
  const final = council?.final
  const hasData = opinions.length || final || error
  const letter = (i) => `Modelo ${String.fromCharCode(65 + i)}`
  const active = opinions[tab]

  // consenso a partir de los rankings reales
  const scores = {}
  reviews.forEach((r) => (r.rankings || []).forEach((rk) => { scores[rk.candidate] = (scores[rk.candidate] || 0) + (rk.score || 0) }))
  const maxScore = Math.max(1, ...Object.values(scores))
  const consensus = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([id, s], i) => ({ id, score: `${s} pts`, pct: `${Math.round((s / maxScore) * 100)}%`, winner: i === 0 }))

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 1 }}>
      <div data-scroll style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 24px 24px' }}>
          {!hasData && !busy && (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px 0' }}>
              <div style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>El consejo está listo.</div>
              <div style={{ fontSize: 14 }}>Haz una pregunta: varios modelos opinarán, se criticarán y el chairman sintetizará.</div>
            </div>
          )}
          {error && <Banner>{error}</Banner>}
          {busy?.mode === 'council' && <RunningStrip stages={busy.stages} done={busy.done} current={busy.current} label="El consejo está deliberando" />}

          {final && (
            <div style={{ border: '1px solid color-mix(in oklab,var(--accent) 32%,var(--line))', borderRadius: 14, padding: 2, background: 'color-mix(in oklab,var(--accent) 5%,var(--surface))', margin: '18px 0 26px', transition: 'border-color 280ms,background 280ms' }}>
              <div style={{ padding: '15px 17px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 5, background: 'var(--accent)', transition: 'background 280ms' }}><Icon name="check" size={11} stroke="#fff" /></span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.02em', transition: 'color 280ms' }}>RESPUESTA FINAL · Chairman</span>
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.62, whiteSpace: 'pre-wrap' }}>{final}</div>
                <div style={{ marginTop: 11, fontSize: 11.5, color: 'var(--text-faint)' }}>Síntesis de {opinions.length} opiniones</div>
              </div>
            </div>
          )}

          {opinions.length > 0 && (
            <>
              <div style={{ ...SECTION_LABEL, marginBottom: 10 }}>Opiniones individuales</div>
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
                {opinions.map((o, i) => (
                  <div key={i} onClick={() => onTab(i)} data-hover style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: `2px solid ${tab === i ? 'var(--accent)' : 'transparent'}`, color: tab === i ? 'var(--accent)' : 'var(--text-dim)', fontWeight: tab === i ? 600 : 500, marginBottom: -1, transition: 'color 160ms' }}>{letter(i)}</div>
                ))}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.62, minHeight: 80 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--text-dim)' }}>{active?.model}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{active?.content}</div>
              </div>
            </>
          )}
        </div>
      </div>
      {panelOpen && (
        <aside style={PANEL_STYLE}>
          <div data-scroll style={{ height: '100%', overflowY: 'auto', padding: '18px 16px' }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 4 }}>Revisión cruzada</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>Cada modelo ordenó las respuestas de los demás. Identidades anonimizadas para evitar sesgo.</div>
            {reviews.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Aún sin revisión.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {reviews.map((r) => {
                const ranked = [...(r.rankings || [])].sort((a, b) => (b.score || 0) - (a.score || 0))
                return (
                  <div key={r.reviewer} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 12px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 6, background: 'var(--surface-2)', fontSize: 11, fontWeight: 600, fontFamily: MONO }}>{r.reviewer}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>valora así:</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ranked.map((rk, i) => (
                        <div key={i} style={{ flex: 1, minWidth: 56, textAlign: 'center', fontFamily: MONO, fontSize: 12, padding: '5px 4px', borderRadius: 7, background: i === 0 ? 'color-mix(in oklab,var(--accent) 14%,var(--surface))' : 'var(--surface-2)', color: i === 0 ? 'var(--accent)' : 'var(--text-dim)', border: `1px solid ${i === 0 ? 'color-mix(in oklab,var(--accent) 30%,transparent)' : 'var(--line)'}` }}>
                          <span style={{ opacity: 0.5, fontSize: 9 }}>{i + 1}º</span> {rk.candidate}:{rk.score}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {consensus.length > 0 && (
              <>
                <div style={{ ...SECTION_LABEL, marginBottom: 10 }}>Consenso</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {consensus.map((c) => (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: MONO, fontWeight: 600, color: c.winner ? 'var(--accent)' : 'var(--text)' }}>{c.id}</span>
                          {c.winner && <span style={{ fontSize: 10, color: 'var(--accent)', border: '1px solid color-mix(in oklab,var(--accent) 40%,transparent)', padding: '0 5px', borderRadius: 20 }}>elegida</span>}
                        </span>
                        <span style={{ color: 'var(--text-faint)' }}>{c.score}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 6, width: c.pct, background: c.winner ? 'var(--accent)' : 'color-mix(in oklab,var(--text-dim) 40%,transparent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}

/* ============================ DEV TEAM ============================ */
function DevTeamView({ busy, panelOpen }) {
  const roles = STAGES_BY_MODE.devteam
  const labels = { architect: 'arquitecto', programmer: 'programador', reviewer: 'revisor', tester: 'tester' }
  // Estado del pipeline a partir del run real (demo) o por defecto.
  const statusOf = (r) => {
    if (busy?.mode === 'devteam') {
      if (busy.done.includes(r)) return 'done'
      if (busy.current === r) return 'running'
      return 'pending'
    }
    return { architect: 'done', programmer: 'running', reviewer: 'pending', tester: 'pending' }[r]
  }
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 1 }}>
      <div data-scroll style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 24px 24px' }}>
          {busy?.mode === 'devteam' && <RunningStrip stages={busy.stages} done={busy.done} current={busy.current} label="El equipo está trabajando" />}
          <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Vista previa del Dev Team. El pipeline real (LangGraph + sandbox) llega en la Fase 4; por ahora el panel refleja el avance por etapas.
          </div>
        </div>
      </div>
      {panelOpen && (
        <aside style={PANEL_STYLE}>
          <div data-scroll style={{ height: '100%', overflowY: 'auto', padding: '18px 16px' }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 16 }}>Pipeline</div>
            <div style={{ position: 'relative' }}>
              {roles.map((r, i) => {
                const st = statusOf(r); const done = st === 'done', running = st === 'running'
                return (
                  <div key={r} style={{ display: 'flex', gap: 11, paddingBottom: 18, position: 'relative' }}>
                    {i < roles.length - 1 && <div style={{ position: 'absolute', left: 13, top: 26, bottom: 0, width: 1.5, background: done ? 'var(--accent)' : 'var(--line)' }} />}
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, background: done ? 'var(--accent)' : 'var(--surface)', border: done ? 'none' : `1.5px solid ${running ? 'var(--accent)' : 'var(--line-2)'}` }}>
                      {done && <Icon name="check" size={13} stroke="#fff" />}
                      {running && <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid color-mix(in oklab,var(--accent) 30%,transparent)', borderTopColor: 'var(--accent)', animation: 'llmc-spin .8s linear infinite' }} />}
                      {!done && !running && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)' }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 3 }}>
                      <div style={{ fontSize: 13.5, fontWeight: running ? 600 : 500, color: st === 'pending' ? 'var(--text-dim)' : 'var(--text)', textTransform: 'capitalize' }}>{labels[r]}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 1 }}>{st === 'done' ? 'completado' : st === 'running' ? 'en curso' : 'en espera'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 6, padding: '9px 11px', borderRadius: 9, background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5, display: 'flex', gap: 7 }}>
              <Icon name="retry" size={14} stroke="var(--text-faint)" />
              <span>Si el <b>tester</b> falla, el trabajo vuelve al <b>programador</b>.</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

/* ============================ SECOND BRAIN ============================ */
function BrainView({ busy, panelOpen, accent }) {
  const notes = [
    { title: 'Sync Strategy', score: '0.94', snippet: 'Decisión: local-first sin servidor de coordinación. El merge ocurre en el cliente.' },
    { title: 'CRDT vs OT', score: '0.91', snippet: 'OT requiere un servidor central que ordene las operaciones. Los CRDT convergen sin coordinación.' },
    { title: 'Yjs vs Automerge', score: '0.78', snippet: 'Yjs gana en coste de memoria y madurez del ecosistema; Automerge tiene mejor API.' },
  ]
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 1 }}>
      <div data-scroll style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px 24px 24px' }}>
          {busy?.mode === 'brain' && <RunningStrip stages={busy.stages} done={busy.done} current={busy.current} label="Buscando en tus notas" />}
          <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Vista previa del Second Brain. El RAG real sobre el vault de Obsidian llega en la Fase 5; el panel muestra las notas recuperadas y el acceso por túnel.
          </div>
        </div>
      </div>
      {panelOpen && (
        <aside style={PANEL_STYLE}>
          <div data-scroll style={{ height: '100%', overflowY: 'auto', padding: '18px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, background: 'color-mix(in oklab,#3f9a6a 12%,var(--surface))', marginBottom: 16 }}>
              <Icon name="lock" size={14} stroke="#3f9a6a" />
              <span style={{ fontSize: 11.5, color: '#3f9a6a', fontWeight: 500 }}>Conectado vía túnel seguro</span>
            </div>
            <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>Notas recuperadas · 3</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n) => (
                <div key={n.title} data-card style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--surface)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Icon name="file" size={13} stroke="var(--accent)" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: MONO, color: 'var(--text-faint)' }}>{n.score}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>{n.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

/* ============================ COMPOSER ============================ */
function Composer({ mode, value, onChange, onSubmit, disabled }) {
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }
  return (
    <div style={{ flex: 'none', borderTop: '1px solid var(--line)', padding: '14px 24px 18px', background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div data-composer style={{ border: '1px solid var(--line-2)', borderRadius: 14, background: 'var(--surface)', padding: '6px 6px 6px 14px', display: 'flex', alignItems: 'flex-end', gap: 8, transition: 'border-color 160ms' }}>
          <textarea value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKey} rows={1}
            placeholder={COMPOSER_PLACEHOLDER[mode]}
            style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, padding: '8px 0', maxHeight: 140 }} />
          <button onClick={onSubmit} disabled={disabled}
            style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 280ms,opacity 160ms', opacity: disabled || !value.trim() ? 0.55 : 1 }}>
            <Icon name="send" size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: MONO }}>{COMPOSER_LANE[mode]}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Enter para enviar</span>
        </div>
      </div>
    </div>
  )
}

/* ============================ SHARED BITS ============================ */
function Banner({ children }) {
  return <div style={{ background: 'color-mix(in oklab,#e0673c 14%,var(--surface))', border: '1px solid color-mix(in oklab,#e0673c 40%,var(--line))', borderRadius: 10, padding: '10px 14px', fontSize: 13, margin: '8px 0' }}>⚠️ {children}</div>
}

// Tira de progreso por ETAPAS (sin ETA por tiempo, regla de CLAUDE.md).
function RunningStrip({ stages, done, current, label }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--surface)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'llmc-pulse 1.3s ease-in-out infinite' }} />{label}…
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {stages.map((s) => {
          const isDone = done.includes(s); const isCur = s === current
          return (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 6, borderRadius: 4, background: isDone ? 'var(--accent)' : isCur ? 'color-mix(in oklab,var(--accent) 55%,var(--surface-2))' : 'var(--surface-2)', animation: isCur ? 'llmc-pulse 1.2s ease-in-out infinite' : 'none' }} />
              <div style={{ fontSize: 11, color: isDone || isCur ? 'var(--text)' : 'var(--text-dim)', marginTop: 5 }}>{stageLabel(s)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Toast no bloqueante al intentar usar otro modo mientras uno trabaja (ADR-0008).
function Toast({ mode, busy, onClose }) {
  const col = ACCENTS[mode]
  const stages = STAGES_BY_MODE[mode]
  const done = busy?.mode === mode ? busy.done : []
  const current = busy?.mode === mode ? busy.current : stages[0]
  const name = TITLES[mode]
  const pct = `${Math.round(((done.length + 0.5) / stages.length) * 100)}%`
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, width: 'min(380px,calc(100vw - 40px))' }}>
      <div style={{ border: '1px solid var(--line-2)', background: 'var(--surface)', borderRadius: 13, padding: '14px 16px', boxShadow: '0 8px 30px -8px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, animation: 'llmc-pulse 1.3s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{name} está trabajando</span>
          <span onClick={onClose} data-hover style={{ cursor: 'pointer', color: 'var(--text-faint)', display: 'flex' }}><Icon name="close" size={15} /></span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
          {stages.map((s) => {
            const on = s === current || done.includes(s)
            return <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 10, padding: '3px 2px', borderRadius: 5, color: on ? col : 'var(--text-faint)', background: s === current ? `color-mix(in oklab,${col} 14%,var(--surface))` : 'var(--surface-2)' }}>{STAGE_LABELS[s]}</div>
          })}
        </div>
        <div style={{ height: 4, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: col, width: pct, transition: 'width 400ms ease' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>No interrumpe lo que estás haciendo · progreso por etapas</div>
      </div>
    </div>
  )
}
