import React, { useRef, useEffect, useState, useCallback } from "react";

/* ============================================================
   LLM Collective — Council, vista interactiva
   Escenario: mesa redonda de caballeros medievales (pixel-art)
   Etapas reales: idle → opinions → review → synthesis → done
   ============================================================ */

const ACCENT = "#16b8a6";       // teal del modo Council
const ACCENT_DK = "#0c8b7e";
const GOLD = "#e8b923";
const STONE = "#1a1d23";
const STONE_2 = "#23272f";

const STAGES = ["idle", "opinions", "review", "synthesis", "done"];
const STAGE_LABEL = {
  idle: "En espera",
  opinions: "Deliberando",
  review: "Evaluándose entre sí",
  synthesis: "El rey sintetiza",
  done: "Veredicto entregado",
};

// Los tres caballeros (modelos) + el rey (chairman). Identidades anónimas A/B/C.
const KNIGHTS = [
  {
    id: "A",
    name: "Caballero de Poniente",
    tag: "Modelo A",
    hue: "#5b8fd6",
    opinion:
      "Persistiría el caché en IndexedDB con una clave derivada del hash del prompt normalizado, incluyendo el id del modelo y los parámetros de muestreo. Dos modelos distintos no deben compartir entradas. Política LRU con tope configurable.",
  },
  {
    id: "B",
    name: "Caballero del Alba",
    tag: "Modelo B",
    hue: "#cf5b7a",
    opinion:
      "Cachear solo respuestas deterministas (temperatura 0). Para las creativas el caché engaña. Versionaría la clave con un hash del system prompt: si cambia, las entradas viejas se invalidan solas.",
  },
  {
    id: "C",
    name: "Caballero del Ocaso",
    tag: "Modelo C",
    hue: "#5bbd8a",
    opinion:
      "Al ser local-first, el caché es otro dato del usuario: vive en el dispositivo y se sincroniza con el resto. No hace falta un servidor central; trátalo como un documento más del modelo de sync existente.",
  },
];

const KING = {
  name: "El Rey",
  tag: "Chairman",
  verdict:
    "Combina caché de contenido (clave = hash del prompt normalizado + parámetros) con LRU persistida en IndexedDB. Cachea de forma agresiva lo determinista, nunca lo creativo. Versiona la clave con el id del modelo y un hash del system prompt. Al ser local-first, el caché se sincroniza como cualquier otro dato del usuario.",
};

// valoración cruzada (anonimizada): quién pone a quién primero
const REVIEW = [
  { from: "A", first: "B", second: "C" },
  { from: "B", first: "C", second: "A" },
  { from: "C", first: "B", second: "A" },
];

export default function CouncilScene() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef({ t: 0, hover: null, seats: [] });
  const [stageIdx, setStageIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(null); // 'A'|'B'|'C'|'king'|null
  const [dark, setDark] = useState(true);

  const stage = STAGES[stageIdx];

  // avanzar etapas automáticamente cuando "running"
  useEffect(() => {
    if (!running) return;
    if (stage === "done") {
      setRunning(false);
      return;
    }
    const dur = stage === "idle" ? 600 : 2600;
    const to = setTimeout(() => setStageIdx((i) => Math.min(i + 1, STAGES.length - 1)), dur);
    return () => clearTimeout(to);
  }, [running, stage, stageIdx]);

  const start = () => {
    setSelected(null);
    setStageIdx(0);
    setRunning(true);
    // saltar idle rápido
    setTimeout(() => setStageIdx(1), 50);
  };
  const reset = () => {
    setRunning(false);
    setStageIdx(0);
    setSelected(null);
  };

  /* ---------- canvas pixel-art ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let raf;

    const resize = () => {
      const r = wrapRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.W = r.width;
      stateRef.current.H = r.height;
    };
    resize();
    window.addEventListener("resize", resize);

    // paleta según tema
    const pal = () =>
      dark
        ? { bg0: "#0e1014", bg1: "#161a20", floor: "#1c2128", floor2: "#171b21", wall: "#11141a", torch: "#ffb24d", grout: "#0b0d11" }
        : { bg0: "#e9e6dc", bg1: "#dcd8cc", floor: "#cfc8b6", floor2: "#c4bca8", wall: "#bfb8a4", torch: "#ff9a3d", grout: "#b3aa94" };

    // helper: bloque "pixel"
    const px = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    // dibuja un caballero sentado mirando al centro
    const drawKnight = (cx, cy, k, opts) => {
      const { speaking, dim, looking, scale } = opts;
      const s = scale; // tamaño de "pixel"
      const a = dim ? 0.32 : 1;
      ctx.globalAlpha = a;
      // sombra
      ctx.globalAlpha = a * 0.25;
      px(cx - 7 * s, cy + 9 * s, 14 * s, 3 * s, "#000");
      ctx.globalAlpha = a;
      // cuerpo (túnica con color del caballero)
      px(cx - 5 * s, cy - 1 * s, 10 * s, 9 * s, k.hue);
      px(cx - 5 * s, cy + 6 * s, 10 * s, 2 * s, shade(k.hue, -28));
      // cinturón
      px(cx - 5 * s, cy + 3 * s, 10 * s, 1 * s, "#3a2c1a");
      // hombros / cota
      px(cx - 6 * s, cy - 1 * s, 12 * s, 2 * s, "#8c93a1");
      // cabeza (yelmo metálico)
      px(cx - 3 * s, cy - 7 * s, 6 * s, 6 * s, "#aeb6c4");
      px(cx - 3 * s, cy - 7 * s, 6 * s, 1 * s, "#cdd4df");
      // visera
      px(cx - 3 * s, cy - 4 * s, 6 * s, 1 * s, "#2b2f37");
      // penacho con el color
      px(cx - 1 * s, cy - 10 * s, 2 * s, 3 * s, k.hue);
      // brazos: si habla, inclinado hacia el centro (gesto)
      if (speaking) {
        px(cx - 7 * s, cy + 1 * s, 2 * s, 4 * s, shade(k.hue, -10));
        px(cx + 5 * s, cy, 3 * s, 2 * s, shade(k.hue, -10)); // brazo extendido
      } else {
        px(cx - 7 * s, cy + 1 * s, 2 * s, 5 * s, shade(k.hue, -10));
        px(cx + 5 * s, cy + 1 * s, 2 * s, 5 * s, shade(k.hue, -10));
      }
      // halo de "hablando"
      if (speaking) {
        ctx.globalAlpha = a * (0.4 + 0.3 * Math.sin(stateRef.current.t / 9));
        ring(ctx, cx, cy - 4 * s, 13 * s, ACCENT);
        ctx.globalAlpha = a;
      }
      // mirada (línea sutil) en review
      if (looking) {
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4 * s);
        ctx.lineTo(looking.x, looking.y - 4 * s);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = a;
      }
      ctx.globalAlpha = 1;
    };

    const drawKing = (cx, cy, opts) => {
      const { active, scale } = opts;
      const s = scale;
      // sombra
      ctx.globalAlpha = 0.25;
      px(cx - 8 * s, cy + 10 * s, 16 * s, 3 * s, "#000");
      ctx.globalAlpha = 1;
      // trono respaldo
      px(cx - 8 * s, cy - 14 * s, 16 * s, 16 * s, dark ? "#2a221a" : "#6b5a3e");
      px(cx - 8 * s, cy - 14 * s, 16 * s, 2 * s, GOLD);
      // manto
      px(cx - 6 * s, cy - 2 * s, 12 * s, 11 * s, "#7a1f2b");
      px(cx - 6 * s, cy + 7 * s, 12 * s, 2 * s, "#5a141d");
      // armiño
      px(cx - 6 * s, cy - 2 * s, 12 * s, 2 * s, "#f0ece2");
      // cabeza
      px(cx - 3 * s, cy - 8 * s, 6 * s, 6 * s, "#e6c9a8");
      px(cx - 3 * s, cy - 3 * s, 6 * s, 1 * s, "#3a2c1a"); // barba sombra
      // corona
      px(cx - 4 * s, cy - 11 * s, 8 * s, 3 * s, GOLD);
      px(cx - 4 * s, cy - 13 * s, 2 * s, 2 * s, GOLD);
      px(cx - 1 * s, cy - 13 * s, 2 * s, 2 * s, GOLD);
      px(cx + 2 * s, cy - 13 * s, 2 * s, 2 * s, GOLD);
      // gema
      px(cx - 1 * s, cy - 10 * s, 2 * s, 1 * s, ACCENT);
      // glow al sintetizar
      if (active) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(stateRef.current.t / 7);
        const g = ctx.createRadialGradient(cx, cy - 4 * s, 0, cx, cy - 4 * s, 40 * s);
        g.addColorStop(0, GOLD);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy - 4 * s, 40 * s, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const draw = () => {
      const st = stateRef.current;
      st.t++;
      const W = st.W, H = st.H;
      const p = pal();
      const cur = stageRef.current;

      // fondo: salón de piedra
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, p.bg1);
      grd.addColorStop(1, p.bg0);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      const cxc = W / 2;
      const cyc = H * 0.52;
      const scale = Math.max(2, Math.min(3.4, W / 320));

      // muro al fondo con antorchas
      px(0, 0, W, H * 0.26, p.wall);
      for (let i = 0; i < 5; i++) {
        const tx = (W / 5) * (i + 0.5);
        const ty = H * 0.13;
        px(tx - 2, ty, 4, 12, "#3a2c1a");
        const fl = 0.5 + 0.5 * Math.sin(st.t / 6 + i);
        ctx.globalAlpha = 0.5 + 0.4 * fl;
        const fg = ctx.createRadialGradient(tx, ty, 0, tx, ty, 22);
        fg.addColorStop(0, p.torch);
        fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(tx, ty, 22, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
        px(tx - 1, ty - 4 - fl * 2, 2, 4, p.torch);
      }

      // suelo en damero (perspectiva fingida con filas)
      for (let row = 0; row < 8; row++) {
        const yy = H * 0.26 + (row / 8) * H * 0.74;
        const hh = (H * 0.74) / 8 + 1;
        for (let col = 0; col < 10; col++) {
          const xx = (col / 10) * W;
          const c = (row + col) % 2 === 0 ? p.floor : p.floor2;
          px(xx, yy, W / 10 + 1, hh, c);
        }
      }

      // tapiz/alfombra central bajo la mesa
      ctx.globalAlpha = 0.5;
      px(cxc - 110, cyc - 70, 220, 150, dark ? "#3a1f24" : "#8a5a52");
      ctx.globalAlpha = 1;

      // mesa redonda (elipse de madera con borde dorado)
      const rx = 96, ry = 52;
      ctx.fillStyle = dark ? "#3b2a18" : "#6b4a26";
      ellipse(ctx, cxc, cyc, rx, ry);
      ctx.fillStyle = dark ? "#4a3620" : "#7d5830";
      ellipse(ctx, cxc, cyc - 3, rx - 6, ry - 5);
      // grano
      ctx.strokeStyle = "rgba(0,0,0,.18)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(cxc, cyc - 3, (rx - 6) * (i / 4), (ry - 5) * (i / 4), 0, 0, 7);
        ctx.stroke();
      }
      // borde dorado
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cxc, cyc, rx, ry, 0, 0, 7);
      ctx.stroke();

      // posiciones de asientos (rey arriba-centro, 3 caballeros alrededor)
      const seats = [];
      // rey arriba-centro; tres caballeros alrededor de la mesa
      const kingPos = { x: cxc, y: cyc - ry - 6, who: "king" };
      const knightPos = [
        { x: cxc - rx - 4, y: cyc + 8, who: "A" },   // izquierda
        { x: cxc + rx + 4, y: cyc + 8, who: "B" },   // derecha
        { x: cxc, y: cyc + ry + 14, who: "C" },      // abajo
      ];
      st.seats = [kingPos, ...knightPos];

      // ¿quién habla en "opinions"? rotamos según el tiempo
      const speakingIdx =
        cur === "opinions" ? Math.floor(st.t / 52) % 3 : -1;

      // dibujar caballeros
      KNIGHTS.forEach((k, i) => {
        const pos = knightPos[i];
        const speaking =
          (cur === "opinions" && speakingIdx === i) ||
          (selectedRef.current === k.id);
        const dim =
          cur === "idle" ||
          (cur === "opinions" && speakingIdx !== i && !speaking) ||
          cur === "synthesis";
        // en review, mira a su primer valorado
        let looking = null;
        if (cur === "review") {
          const rv = REVIEW.find((r) => r.from === k.id);
          const targetIdx = KNIGHTS.findIndex((x) => x.id === rv.first);
          looking = knightPos[targetIdx];
        }
        drawKnight(pos.x, pos.y, k, { speaking, dim: dim && !speaking, looking, scale });
      });

      // rey
      const kingActive = cur === "synthesis" || cur === "done";
      drawKing(kingPos.x, kingPos.y, { active: kingActive, scale });

      // flujo de energía hacia el rey en synthesis
      if (cur === "synthesis") {
        knightPos.forEach((pos) => {
          const prog = (st.t % 60) / 60;
          const fx = pos.x + (kingPos.x - pos.x) * prog;
          const fy = pos.y - 4 + (kingPos.y - 4 - (pos.y - 4)) * prog;
          ctx.globalAlpha = (1 - prog) * 0.9;
          px(fx - 1.5, fy - 1.5, 3, 3, GOLD);
          ctx.globalAlpha = 1;
        });
      }

      // pergamino/veredicto en el centro cuando done
      if (cur === "done") {
        const pw = 40, ph = 26;
        px(cxc - pw / 2, cyc - ph / 2, pw, ph, "#efe6cf");
        px(cxc - pw / 2, cyc - ph / 2, pw, 2, "#d8c79f");
        px(cxc - pw / 2, cyc + ph / 2 - 2, pw, 2, "#d8c79f");
        ctx.strokeStyle = "#bda874";
        ctx.lineWidth = 1;
        for (let l = 0; l < 4; l++) {
          ctx.beginPath();
          ctx.moveTo(cxc - pw / 2 + 5, cyc - ph / 2 + 6 + l * 4);
          ctx.lineTo(cxc + pw / 2 - 5, cyc - ph / 2 + 6 + l * 4);
          ctx.stroke();
        }
        // sello
        px(cxc - 3, cyc + ph / 2 - 7, 6, 6, "#9a2b2b");
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(st.t / 10);
        ring(ctx, cxc, cyc, 30, GOLD);
        ctx.globalAlpha = 1;
      }

      // hover highlight
      if (st.hover) {
        ctx.globalAlpha = 0.8;
        ring(ctx, st.hover.x, st.hover.y - 4 * scale, 16 * scale, "#ffffff");
        ctx.globalAlpha = 1;
      }

      // viñeta
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, dark ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.12)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [dark]);

  // refs espejo para usar dentro del loop sin re-crear
  const stageRef = useRef(stage);
  const selectedRef = useRef(selected);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // click / hover sobre asientos
  const hitTest = useCallback((mx, my) => {
    const seats = stateRef.current.seats || [];
    const scale = Math.max(2, Math.min(3.4, (stateRef.current.W || 320) / 320));
    for (const s of seats) {
      const dx = mx - s.x, dy = my - (s.y - 4 * scale);
      if (Math.hypot(dx, dy) < 18 * scale) return s;
    }
    return null;
  }, []);

  const onMove = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
    stateRef.current.hover = hit;
    canvasRef.current.style.cursor = hit ? "pointer" : "default";
  };
  const onClick = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (hit) setSelected(hit.who === "king" ? "king" : hit.who);
    else setSelected(null);
  };

  const detail = getDetail(selected);

  return (
    <div style={{ ...wrap, background: dark ? STONE : "#efece4", color: dark ? "#e9eaee" : "#1b1d22" }}>
      {/* barra superior */}
      <div style={topbar(dark)}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={crest}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>Council · La mesa redonda</div>
            <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>vista interactiva · 3 caballeros + rey</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setDark((d) => !d)} style={ghostBtn(dark)} title="Tema">
          {dark ? "☀" : "☾"}
        </button>
        {stage === "done" || !running ? (
          <button onClick={start} style={primaryBtn}>▶ Convocar consejo</button>
        ) : (
          <button onClick={reset} style={ghostBtn(dark)}>Detener</button>
        )}
      </div>

      {/* etapa actual / barra de progreso por etapas */}
      <div style={stageBar(dark)}>
        {STAGES.filter((s) => s !== "idle").map((s) => {
          const order = ["opinions", "review", "synthesis", "done"];
          const curOrder = order.indexOf(stage === "idle" ? "opinions" : stage);
          const myOrder = order.indexOf(s);
          const active = myOrder === curOrder && running;
          const passed = myOrder < curOrder || stage === "done";
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: active ? ACCENT : passed ? ACCENT_DK : (dark ? "#3a3f49" : "#cfcabb"),
                boxShadow: active ? `0 0 0 4px ${ACCENT}22` : "none",
                flex: "none",
              }} />
              <span style={{
                fontSize: 11.5,
                color: active ? ACCENT : passed ? (dark ? "#9aa0ab" : "#6b6f78") : (dark ? "#5a5f69" : "#a8a392"),
                fontWeight: active ? 600 : 500,
                whiteSpace: "nowrap",
              }}>
                {STAGE_LABEL[s]}
              </span>
              {myOrder < 3 && <span style={{ flex: 1, height: 1, background: dark ? "#2a2e36" : "#ddd8c9" }} />}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* escenario */}
        <div ref={wrapRef} style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <canvas
            ref={canvasRef}
            onMouseMove={onMove}
            onClick={onClick}
            onMouseLeave={() => (stateRef.current.hover = null)}
            style={{ display: "block", imageRendering: "pixelated" }}
          />
          {/* pista de interacción */}
          <div style={hintPill(dark)}>
            {stage === "idle" && !running ? "Convoca al consejo para empezar" : "Haz clic en un personaje para ver su intervención"}
          </div>
        </div>

        {/* panel de detalle al hacer clic */}
        <aside style={sidePanel(dark, !!selected)}>
          {detail ? (
            <div style={{ padding: 18 }}>
              <button onClick={() => setSelected(null)} style={closeBtn(dark)}>✕</button>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 7, flex: "none",
                  background: detail.color, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "#fff", fontSize: 13,
                }}>{detail.badge}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{detail.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>{detail.tag}</div>
                </div>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.62, marginTop: 14, opacity: 0.92 }}>{detail.text}</p>

              {detail.king && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${dark ? "#2a2e36" : "#e3dccd"}` }}>
                  <div style={eyebrow(dark)}>Cómo se decidió</div>
                  {REVIEW.map((r) => (
                    <div key={r.from} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 6 }}>
                      <span style={miniBadge}>{r.from}</span>
                      <span style={{ opacity: 0.6 }}>valora →</span>
                      <span style={{ ...miniBadge, background: ACCENT, color: "#fff" }}>{r.first}</span>
                      <span style={miniBadge}>{r.second}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8 }}>Consenso: el Caballero del Alba (B) fue el más votado. El rey sintetizó sobre esa base.</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 22, opacity: 0.55, fontSize: 13, lineHeight: 1.6 }}>
              <div style={eyebrow(dark)}>Sin selección</div>
              <p style={{ marginTop: 10 }}>
                Cada caballero es uno de los modelos. El rey es el chairman que sintetiza.
                Haz clic en cualquiera para leer su intervención real.
              </p>
              <p style={{ marginTop: 10 }}>
                Mientras el consejo delibera, los otros modos quedan en espera.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------------- detalle ---------------- */
function getDetail(sel) {
  if (!sel) return null;
  if (sel === "king") return { badge: "♔", name: KING.name, tag: KING.tag, text: KING.verdict, color: "#9a2b2b", king: true };
  const k = KNIGHTS.find((x) => x.id === sel);
  if (!k) return null;
  return { badge: k.id, name: k.name, tag: k.tag, text: k.opinion, color: k.hue };
}

/* ---------------- helpers de dibujo ---------------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
function ellipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
  ctx.fill();
}
function ring(ctx, cx, cy, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 7);
  ctx.stroke();
}

/* ---------------- estilos ---------------- */
const wrap = {
  display: "flex", flexDirection: "column", height: "100vh", width: "100%",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  overflow: "hidden",
};
const topbar = (d) => ({
  height: 54, flex: "none", display: "flex", alignItems: "center", gap: 10,
  padding: "0 16px", borderBottom: `1px solid ${d ? "#23262d" : "#e2dccd"}`,
});
const crest = {
  width: 26, height: 26, borderRadius: 7, background: ACCENT,
  display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
};
const stageBar = (d) => ({
  display: "flex", alignItems: "center", gap: 4, padding: "10px 18px",
  borderBottom: `1px solid ${d ? "#1f2229" : "#e7e1d3"}`,
});
const primaryBtn = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 9,
  padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const ghostBtn = (d) => ({
  background: "transparent", color: d ? "#cfd2d8" : "#444", cursor: "pointer",
  border: `1px solid ${d ? "#2d313a" : "#d8d2c3"}`, borderRadius: 9,
  padding: "7px 12px", fontSize: 13,
});
const sidePanel = (d, open) => ({
  width: open ? 300 : 240, flex: "none", borderLeft: `1px solid ${d ? "#23262d" : "#e2dccd"}`,
  background: d ? STONE_2 : "#f6f3ec", transition: "width 200ms ease", position: "relative",
  overflowY: "auto",
});
const hintPill = (d) => ({
  position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
  background: d ? "rgba(20,22,27,.82)" : "rgba(255,255,255,.85)",
  border: `1px solid ${d ? "#2d313a" : "#ddd6c6"}`, borderRadius: 20,
  padding: "6px 14px", fontSize: 12, color: d ? "#aab0bb" : "#6b6f78",
  backdropFilter: "blur(6px)", whiteSpace: "nowrap",
});
const closeBtn = (d) => ({
  position: "absolute", top: 12, right: 12, background: "transparent",
  border: "none", color: d ? "#7a808b" : "#9a958a", cursor: "pointer", fontSize: 15,
});
const eyebrow = (d) => ({
  fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase",
  fontWeight: 700, color: d ? "#5f6571" : "#a39d8d",
});
const miniBadge = {
  width: 18, height: 18, borderRadius: 5, background: "rgba(127,127,127,.16)",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700,
};
