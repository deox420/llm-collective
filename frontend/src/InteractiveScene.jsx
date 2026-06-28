import { useEffect, useReducer, useRef, useState } from 'react'
import { SCENE_THEMES } from './scenes.js'

const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']
function dir8(dx, dy) {
  const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360  // 0=E, 90=S(abajo), 270=N
  return DIRS[Math.round(a / 45) % 8]
}
// Reduce 8 direcciones a las 4 cardinales con tira de marcha (diagonales → horizontal).
function walkKey(dir) {
  if (dir === 'N' || dir === 'S' || dir === 'E' || dir === 'W') return dir
  return (dir === 'NE' || dir === 'SE') ? 'E' : 'W'
}

// Motor de marcha (SDD §14.3.6): interpola la posición de cada agente hacia su
// destino (choreography) a velocidad constante, eligiendo el rumbo (8 dir) mientras
// camina; al llegar adopta su acción. prefers-reduced-motion → sin tween (salta).
function useChoreography(theme, ctx) {
  const ctxRef = useRef(ctx); ctxRef.current = ctx
  const st = useRef(null)
  const [, tick] = useReducer((x) => (x + 1) % 1e9, 0)
  if (st.current == null) {
    st.current = {}
    const init = theme.choreography(ctx)
    for (const a of theme.agents) {
      const t = init[a.id] || { at: { x: 50, y: 50 }, face: 'S', act: 'idle' }
      st.current[a.id] = { x: t.at.x, y: t.at.y, dir: t.face || 'S', motion: t.act || 'idle' }
    }
  }
  useEffect(() => {
    let raf, last = null
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SPEED = 34  // % de lienzo por segundo
    const loop = (ts) => {
      if (last == null) last = ts
      const dt = Math.min((ts - last) / 1000, 0.05); last = ts
      const tg = theme.choreography(ctxRef.current)
      let dirty = false
      for (const a of theme.agents) {
        const s = st.current[a.id], t = tg[a.id]; if (!t) continue
        const dx = t.at.x - s.x, dy = t.at.y - s.y, dist = Math.hypot(dx, dy)
        if (dist > 0.8 && !reduce) {
          const mv = Math.min(dist, SPEED * dt)
          s.x += dx / dist * mv; s.y += dy / dist * mv
          s.dir = dir8(dx, dy); s.motion = 'walk'; dirty = true
        } else {
          if (s.x !== t.at.x || s.y !== t.at.y) { s.x = t.at.x; s.y = t.at.y; dirty = true }
          const nm = t.act || 'idle', nf = t.face || s.dir
          if (s.motion !== nm) { s.motion = nm; dirty = true }
          if (s.dir !== nf) { s.dir = nf; dirty = true }
        }
      }
      if (dirty) tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [theme])
  return st.current
}

// Vista interactiva. Refleja el estado REAL del pipeline (regla de oro §13.2).
//
// Dos contratos conviven:
//  - v2 (SDD §14.4): el tema expone choreography(state)→acción por agente y
//    propsFor(state)→objetos dinámicos. Motor sentado/levantado (Council). El
//    movimiento de marcha (Dev Team/Second Brain) llegará con sus temas v2.
//  - v1 (doc 13 §13.4): layout(stage)+poseFor(agent) con sprites/placeholders
//    (Dev Team y Second Brain, hasta que se rehagan a v2).
//
// Sin assets de PixelLab, todo cae a placeholders DOM/CSS con el mismo contrato.
// prefers-reduced-motion desactiva animaciones por CSS (NFR-INT-1 / NFR-SCN-1).
export default function InteractiveScene({ mode, busy, data }) {
  const theme = SCENE_THEMES[mode]
  const [selected, setSelected] = useState(null)
  if (!theme) return null

  const here = busy?.mode === mode ? busy : null
  const stage = here?.current || null
  const working = !!here
  const detail = selected ? theme.detailFor(selected, data) : null
  const background = theme.assets?.background || null
  const isV2 = typeof theme.choreography === 'function'
  const walks = theme.locomotion === 'walk'

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 1 }}>
      <div data-scroll style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '20px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 600 }}>
              Escena · {theme.label}
            </span>
            {working && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'llmc-pulse 1.3s ease-in-out infinite' }} />}
          </div>

          <div
            className={`iscene ${working ? 'iscene-working' : ''}`}
            style={background ? { backgroundImage: `url(${background})`, backgroundSize: '100% 100%' } : undefined}
          >
            {isV2
              ? (walks
                  ? <SceneV2Walk theme={theme} ctx={{ stage, working, data }} onSelect={setSelected} />
                  : <SceneV2 theme={theme} ctx={{ stage, working, data }} onSelect={setSelected} />)
              : <SceneV1 theme={theme} ctx={{ stage, busy: here, data }} onSelect={setSelected} />}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 12, textAlign: 'center' }}>
            Cada acción refleja la etapa real. Clic en un personaje para ver su contenido.
          </p>

          {detail && (
            <div className="iscene-detail">
              <div className="iscene-detail-head">
                <strong>{detail.title}</strong>
                <button onClick={() => setSelected(null)} aria-label="cerrar">✕</button>
              </div>
              <div className="iscene-detail-body">{detail.body}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- v2: coreografía sentada (Council). Cada agente adopta una ACCIÓN derivada
// del estado real; los pergaminos aparecen como props. Placeholders DOM/CSS hasta
// que existan los sprites por acción/dirección (SDD §14.5). ---------------------
function SceneV2({ theme, ctx, onSelect }) {
  const chor = theme.choreography(ctx)
  const props = theme.propsFor ? theme.propsFor(ctx) : []
  const A = theme.assets || {}
  const table = A.table
  const tablePos = A.tablePos || { x: 50, y: 58, w: 50 }
  const scrolls = A.scrolls || {}
  const sprites = A.sprites || {}
  const anim = A.anim || {}
  return (
    <>
      {/* mesa redonda (sprite real si existe), detrás de todo */}
      {table && (
        <img className="iscene-table" src={table} alt="" aria-hidden
          style={{ left: `${tablePos.x}%`, top: `${tablePos.y}%`, width: `${tablePos.w}%` }} />
      )}
      {/* pergaminos: sprite real por tipo si existe, si no placeholder CSS */}
      {props.map((p) => (
        scrolls[p.kind]
          ? <img key={p.id} className={`iscene-propimg ${p.kind}`} src={scrolls[p.kind]} alt="" aria-hidden style={{ left: `${p.x}%`, top: `${p.y}%` }} />
          : <span key={p.id} className={`iscene-prop ${p.kind}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden />
      ))}
      {theme.agents.map((a) => {
        const m = chor[a.id] || { at: a, face: a.face, act: 'sit_idle' }
        const strip = anim[a.id]?.[m.act]      // tira de animación para esta acción
        const sprite = sprites[a.id]           // sprite estático (frame de su dirección)
        return (
          <button
            key={a.id}
            className={`iscene-actor act-${m.act} face-${m.face} kind-${a.kind}`}
            style={{ left: `${m.at.x}%`, top: `${m.at.y}%`, '--tint': a.tint, zIndex: Math.round(m.at.y) }}
            onClick={() => onSelect(a.id)}
            title={`${a.name} — clic para ver detalle`}
          >
            {strip
              ? <span className="iscene-actor-anim" style={{ backgroundImage: `url(${strip})` }} aria-hidden />
              : sprite
                ? <img className="iscene-actor-sprite" src={sprite} alt={a.name} aria-hidden />
                : <span className="iscene-fig2" aria-hidden />}
            <span className="iscene-name">{a.name}</span>
          </button>
        )
      })}
    </>
  )
}

// --- v2 con marcha (Dev Team): los agentes CAMINAN entre zonas. El motor
// (useChoreography) da posición/rumbo/acción; aquí se pinta el ciclo de marcha por
// dirección o la acción al llegar. Sin sprites → placeholder que igualmente se mueve.
function SceneV2Walk({ theme, ctx, onSelect }) {
  const states = useChoreography(theme, ctx)
  const A = theme.assets || {}
  const sprites = A.sprites || {}
  const anim = A.anim || {}
  const decor = (A.decor || []).filter((d) => d.src)
  return (
    <>
      {decor.map((d) => (
        <img key={d.id} className="iscene-decor" src={d.src} alt="" aria-hidden
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%` }} />
      ))}
      {theme.agents.map((a) => {
        const s = states[a.id] || { x: 50, y: 50, dir: 'S', motion: 'idle' }
        const strip = s.motion === 'walk'
          ? anim[a.id]?.walk?.[walkKey(s.dir)]
          : (anim[a.id]?.[s.motion] || anim[a.id]?.talk)
        const sprite = sprites[a.id]
        return (
          <button
            key={a.id}
            className={`iscene-actor motion-${s.motion} kind-${a.kind}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, '--tint': a.tint, zIndex: Math.round(s.y) }}
            onClick={() => onSelect(a.id)}
            title={`${a.name} — clic para ver detalle`}
          >
            {strip
              ? <span className="iscene-actor-anim" style={{ backgroundImage: `url(${strip})` }} aria-hidden />
              : sprite
                ? <img className="iscene-actor-sprite" src={sprite} alt={a.name} aria-hidden />
                : <span className="iscene-fig2" aria-hidden />}
            <span className="iscene-name">{a.name}</span>
          </button>
        )
      })}
    </>
  )
}

// --- v1: layout fijo + pose por agente, con sprites reales o placeholders
// (Dev Team y Second Brain hasta su versión v2). --------------------------------
function SceneV1({ theme, ctx, onSelect }) {
  const placements = theme.layout(ctx.stage)
  const sprites = theme.assets?.sprites || {}
  const anims = theme.assets?.anim || {}
  const decor = (theme.assets?.decor || []).filter((d) => d.src)
  const tableSprite = theme.assets?.table || null
  const scrollSprite = theme.assets?.scroll || null
  const showScroll = !!scrollSprite && !!ctx.data?.final
  return (
    <>
      {decor.map((d) => (
        <img key={d.id} className="iscene-decor" src={d.src} alt="" aria-hidden
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%` }} />
      ))}
      {tableSprite ? (
        <div className="iscene-center iscene-center-sprite">
          <img src={tableSprite} alt={theme.centerLabel} aria-hidden />
          {showScroll && <img className="iscene-scroll" src={scrollSprite} alt="veredicto" />}
        </div>
      ) : (
        <div className="iscene-center"><span>{theme.centerLabel}</span></div>
      )}
      {theme.agents.map((a) => {
        const pos = placements[a.id]
        const pose = theme.poseFor(a.id, ctx)
        const sprite = sprites[a.id]
        const anim = anims[a.id]
        const playing = anim && (pose === 'talk' || pose === 'active')
        return (
          <button
            key={a.id}
            className={`iscene-agent pose-${pose}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, '--tint': a.tint }}
            onClick={() => onSelect(a.id)}
            title={`${a.name} — clic para ver detalle`}
          >
            {playing
              ? <span className="iscene-anim" style={{ backgroundImage: `url(${anim})` }} aria-hidden />
              : sprite
                ? <img className="iscene-sprite" src={sprite} alt={a.name} aria-hidden />
                : <span className="iscene-fig" aria-hidden />}
            <span className="iscene-name">{a.name}</span>
          </button>
        )
      })}
    </>
  )
}
