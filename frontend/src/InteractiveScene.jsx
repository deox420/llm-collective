import { useState } from 'react'
import { SCENE_THEMES } from './scenes.js'

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
            style={background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {isV2
              ? <SceneV2 theme={theme} ctx={{ stage, working, data }} onSelect={setSelected} />
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
  return (
    <>
      {props.map((p) => (
        <span key={p.id} className={`iscene-prop ${p.kind}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden />
      ))}
      {theme.agents.map((a) => {
        const m = chor[a.id] || { at: a, face: a.face, act: 'sit_idle' }
        return (
          <button
            key={a.id}
            className={`iscene-actor act-${m.act} face-${m.face} kind-${a.kind}`}
            style={{ left: `${m.at.x}%`, top: `${m.at.y}%`, '--tint': a.tint }}
            onClick={() => onSelect(a.id)}
            title={`${a.name} — clic para ver detalle`}
          >
            <span className="iscene-fig2" aria-hidden />
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
