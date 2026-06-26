import { useEffect, useRef } from 'react'

// Campo de partículas de fondo (estilo ralv.ai), portado del diseño Claude Design.
// En reposo flota lento; "working" pulsa y hace fluir energía hacia el nodo central.
// El color es el acento del modo (RGB). Respeta prefers-reduced-motion.
export default function ParticleField({ accentRGB, working, intensity = 'immersive' }) {
  const canvasRef = useRef(null)
  // Refs para que el loop lea estado fresco sin reiniciarse.
  const stateRef = useRef({ accentRGB, working })
  stateRef.current = { accentRGB, working }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    const P = intensity === 'restrained'
      ? { N: 24, maxD: 0.14, restLine: 0.045, workLine: 0.11, restDot: 0.16, workDot: 0.30, glow: 34, spawn: 0.22, glowA: 0.30 }
      : { N: 48, maxD: 0.17, restLine: 0.10, workLine: 0.22, restDot: 0.30, workDot: 0.55, glow: 48, spawn: 0.45, glowA: 0.55 }

    const nodes = Array.from({ length: P.N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00007, vy: (Math.random() - 0.5) * 0.00007,
      r: 1 + Math.random() * 1.7, ph: Math.random() * Math.PI * 2,
    }))
    let flows = []
    const central = { x: 0.5, y: 0.46 }
    let cur = (stateRef.current.accentRGB || [91, 91, 214]).slice()
    let ctx, W = 0, H = 0, raf

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const r = canvas.getBoundingClientRect()
      if (!r.width) return
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      W = r.width; H = r.height
    }
    resize()
    window.addEventListener('resize', resize)

    const ease = (t) => t * t * (3 - 2 * t)
    const lerp = (a, b, t) => a + (b - a) * t

    const drawStatic = () => {
      // Sin animación: nodos y líneas en reposo (NFR-INT-1).
      if (!ctx) return
      const tg = stateRef.current.accentRGB || cur
      const [r, g, b] = tg.map(Math.round)
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], bn = nodes[j]
        const d = Math.hypot(a.x - bn.x, a.y - bn.y)
        if (d < P.maxD) {
          const al = P.restLine * (1 - d / P.maxD)
          if (al > 0.003) { ctx.strokeStyle = `rgba(${r},${g},${b},${al})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(bn.x * W, bn.y * H); ctx.stroke() }
        }
      }
      for (const n of nodes) { ctx.fillStyle = `rgba(${r},${g},${b},${P.restDot})`; ctx.beginPath(); ctx.arc(n.x * W, n.y * H, n.r, 0, 6.2832); ctx.fill() }
    }

    const loop = () => {
      const { accentRGB, working } = stateRef.current
      const tg = accentRGB || cur
      if (ctx) {
        for (let k = 0; k < 3; k++) cur[k] = lerp(cur[k], tg[k], 0.05)
        const r = Math.round(cur[0]), g = Math.round(cur[1]), b = Math.round(cur[2])
        const t = performance.now() / 1000
        const stageFrac = 0.45
        ctx.clearRect(0, 0, W, H)
        for (const n of nodes) { n.x += n.vx; n.y += n.vy; if (n.x < 0.02 || n.x > 0.98) n.vx *= -1; if (n.y < 0.02 || n.y > 0.98) n.vy *= -1 }
        const baseLine = working ? P.workLine : P.restLine
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], bn = nodes[j]
          const dx = a.x - bn.x, dy = a.y - bn.y, d = Math.hypot(dx, dy)
          if (d < P.maxD) {
            let al = baseLine * (1 - d / P.maxD)
            if (working) al *= 0.6 + 0.5 * Math.sin(t * 1.8 * (0.6 + stageFrac) - (a.x + a.y) * 5)
            if (al > 0.003) { ctx.strokeStyle = `rgba(${r},${g},${b},${al})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(bn.x * W, bn.y * H); ctx.stroke() }
          }
        }
        const baseDot = working ? P.workDot : P.restDot
        for (const n of nodes) { const pulse = working ? 0.6 + 0.4 * Math.sin(t * 1.8 + n.ph) : 1; ctx.fillStyle = `rgba(${r},${g},${b},${baseDot * pulse})`; ctx.beginPath(); ctx.arc(n.x * W, n.y * H, n.r * (working ? 1.25 : 1), 0, 6.2832); ctx.fill() }
        if (working) {
          if (Math.random() < P.spawn) { const s = nodes[Math.floor(Math.random() * nodes.length)]; flows.push({ sx: s.x, sy: s.y, x: s.x, y: s.y, p: 0 }) }
          for (const f of flows) { f.p += 0.016 * (0.7 + stageFrac); const e = ease(Math.min(1, f.p)); f.x = lerp(f.sx, central.x, e); f.y = lerp(f.sy, central.y, e) }
          flows = flows.filter((f) => f.p < 1)
          for (const f of flows) { const al = (1 - f.p) * 0.9; ctx.fillStyle = `rgba(${r},${g},${b},${al})`; ctx.beginPath(); ctx.arc(f.x * W, f.y * H, 1.9, 0, 6.2832); ctx.fill() }
          const cx = central.x * W, cy = central.y * H
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, P.glow)
          grd.addColorStop(0, `rgba(${r},${g},${b},${P.glowA})`); grd.addColorStop(1, `rgba(${r},${g},${b},0)`)
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, P.glow, 0, 6.2832); ctx.fill()
          ctx.fillStyle = `rgba(${r},${g},${b},0.9)`; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, 6.2832); ctx.fill()
        }
      }
      raf = requestAnimationFrame(loop)
    }

    if (reduce) { setTimeout(drawStatic, 30) }
    else { raf = requestAnimationFrame(loop) }

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [intensity])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}
