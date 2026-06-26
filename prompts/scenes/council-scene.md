# Prompt — Council: medieval round table (Claude Design test)

**Test / throwaway version.** This prompt exists to evaluate **how Claude Design interprets and draws pixel-art**. The final render will NOT use this: it will use PixelLab assets ([ADR-0007](../../docs/adr/0007-pixellab-assets.md)). It does not feed into the final development.

Paste the block below into Claude Design.

---

```prompt
<role>
You are an interface and pixel-art game designer. You build an interactive scene where medieval characters represent AI models deliberating, acting according to the real state of the process.
</role>

<context>
LLM Collective is a local-first app. The "Council" mode asks several models a question; they deliberate, evaluate each other, and a "chairman" synthesizes the final answer. This is the INTERACTIVE VIEW of that mode: a medieval round table where you watch the council work, instead of reading a chat thread.
The mode's accent color is teal #16b8a6 and it must tint the whole scene (halos, progress bar, panel, lighting). Gold #e8b923 is for the king and the verdict.
</context>

<input>
Setting: a stone hall with a round table, wall torches, and a checkerboard floor.

Characters:
- Knight A — "Knight of the West" (Model A). Text: "I'd persist the cache in IndexedDB with key = hash of the normalized prompt + model id + parameters. Two different models must not share entries. LRU with a configurable cap."
- Knight B — "Knight of the Dawn" (Model B). Text: "Only cache deterministic responses (temperature 0). Version the key with a hash of the system prompt: if it changes, old entries invalidate themselves."
- Knight C — "Knight of the Dusk" (Model C). Text: "Since it's local-first, the cache is just another piece of user data: it lives on the device and syncs with the rest. No central server needed."
- The King (Chairman). Verdict: "Content cache (hash of prompt + parameters) + LRU in IndexedDB. Cache the deterministic, never the creative. Version the key with model id and a hash of the system prompt. Being local-first, it syncs like any other data."

User question that triggers the session: "What's the best strategy for caching LLM responses in a local-first app?"

Real stages (in order) and behavior:
1. opinions   — the three knights speak in turns: whoever speaks leans toward the table and gets a teal halo; the others dim.
2. review     — the knights look at each other (dashed gaze lines), anonymized A/B/C ranking; the most-voted is B.
3. synthesis  — golden energy flows from the three knights toward the king, who lights up.
4. done        — a sealed scroll appears at the center of the table: the king's verdict.
</input>

<instructions>
1. Draw everything in pixel-art inside a <canvas>: knights with helmets and plumes, a king with a crown and throne, a round table with a gold rim, flickering torches, a checkerboard floor. Limited palette, crisp edges, image-rendering: pixelated.
2. Add a "Convene the council" button. On click, run through the 4 stages in order with a STAGE-based progress bar (Deliberating → Reviewing → King synthesizes → Verdict). No time-based ETA.
3. Animate each stage per the input (halo on the speaker, gaze lines in review, golden flow in synthesis, scroll in done).
4. Detail on demand: clicking a knight or the king opens a side panel showing their real text (their opinion, or the king's verdict with the A/B/C vote breakdown). Mark who is clickable with a hover ring.
5. Teal #16b8a6 tints halos, bar, panel, and lighting. Gold #e8b923 belongs to the king and the verdict.
6. Light and dark themes, togglable.
7. prefers-reduced-motion: static poses, no animation.
</instructions>

<constraints>
- A single self-contained React file (.jsx), React as the only dependency.
- No localStorage/sessionStorage: keep everything in React state.
- Do not add stages or characters beyond those in the input.
- Stage advancement lives in one function (so it can be wired to the backend later); the pixel-art is a PLACEHOLDER drawn with canvas rectangles, not assets.
</constraints>

<output_format>
A single-file default React component. Brief comments marking: (a) the stage-advance function, (b) the stage→pose map, (c) where the PixelLab sprites will go.
</output_format>

<closing>
Decide the layout first (king at the top, three knights around the table) and the stage→pose map; then draw. Keep the state logic separate from the drawing.
</closing>
```

---

## What to watch for in Claude Design's output
- Does it actually interpret **pixel-art**, or fall back to smooth vector shapes?
- Is the **stage-based bar** clear (no ETA)?
- Does **click → detail** work and show the real text?
- Does the **teal** genuinely tint the whole scene?

Whatever the result, it's **exploratory**: the final render will be done with PixelLab sprites.
