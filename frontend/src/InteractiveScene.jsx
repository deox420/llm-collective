import { useState } from 'react'
import { SCENE_THEMES } from './scenes.js'

// Vista interactiva (placeholder, Fase 6). Consume el SceneTheme (§13.4) y refleja
// el estado REAL del pipeline: la pose de cada agente sale de la etapa/datos reales
// (no animación falsa). Clic en un personaje → su contenido real (§FR-INT-3).
// Los sprites finales de PixelLab (ASSETS.md) sustituyen estos placeholders sin
// tocar este componente (mismo contrato). Respeta prefers-reduced-motion (CSS).
export default function InteractiveScene({ mode, busy, data }) {
  const theme = SCENE_THEMES[mode]
  const [selected, setSelected] = useState(null)
  if (!theme) return null

  const here = busy?.mode === mode ? busy : null
  const stage = here?.current || null
  const placements = theme.layout(stage)
  const ctx = { stage, busy: here, data }
  const working = !!here
  const detail = selected ? theme.detailFor(selected, data) : null

  const sprites = theme.assets?.sprites || {}
  const anims = theme.assets?.anim || {}
  const tableSprite = theme.assets?.table || null
  const scrollSprite = theme.assets?.scroll || null
  const showScroll = !!scrollSprite && !!data?.final  // pergamino del veredicto (etapa done)

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

          <div className={`iscene ${working ? 'iscene-working' : ''}`}>
            {/* nodo central (mesa / reunión / mostrador). Sprite real si existe. */}
            {tableSprite ? (
              <div className="iscene-center iscene-center-sprite">
                <img src={tableSprite} alt={theme.centerLabel} aria-hidden />
                {showScroll && <img className="iscene-scroll" src={scrollSprite} alt="veredicto" />}
              </div>
            ) : (
              <div className="iscene-center">
                <span>{theme.centerLabel}</span>
              </div>
            )}
            {/* personajes posicionados por el layout del tema: sprite real o placeholder */}
            {theme.agents.map((a) => {
              const pos = placements[a.id]
              const pose = theme.poseFor(a.id, ctx)
              const sprite = sprites[a.id]
              const anim = anims[a.id]
              // Reproduce la animación solo cuando el agente actúa de verdad
              // (pose talk/active) y existe el spritesheet; si no, sprite estático.
              const playing = anim && (pose === 'talk' || pose === 'active')
              return (
                <button
                  key={a.id}
                  className={`iscene-agent pose-${pose}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, '--tint': a.tint }}
                  onClick={() => setSelected(a.id)}
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
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 12, textAlign: 'center' }}>
            Cada pose refleja la etapa real. Clic en un personaje para ver su contenido.
            {!sprites[theme.agents[0].id] && (
              <><br />Sprites pixel-art (PixelLab) pendientes: el render usa placeholders con el mismo contrato.</>
            )}
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
