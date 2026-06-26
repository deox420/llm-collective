// Cliente del backend: SSE por fetch streaming (permite leer códigos de estado
// como 409 'mode_busy', cosa que EventSource no facilita).

function parseSSEBlock(block) {
  let event = null
  let data = null
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data = line.slice(5).trim()
  }
  if (!event) return null
  return { event, data: data ? JSON.parse(data) : {} }
}

export class ModeBusyError extends Error {
  constructor(activeMode) {
    super(`mode_busy: ${activeMode}`)
    this.code = 'mode_busy'
    this.activeMode = activeMode
  }
}

// Lanza el flujo SSE de un modo. onEvent({event, data}) por cada evento de etapa.
export async function runMode(mode, { onOpen, onEvent } = {}) {
  const res = await fetch(`/api/demo/${mode}/run`, { method: 'POST' })
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}))
    throw new ModeBusyError(body?.error?.active_mode)
  }
  if (!res.ok || !res.body) {
    throw new Error(`http_error_${res.status}`)
  }
  onOpen && onOpen()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const ev = parseSSEBlock(block)
      if (ev) onEvent && onEvent(ev)
    }
  }
}

export async function fetchHealth() {
  const r = await fetch('/api/health')
  return r.json()
}

export async function fetchStatus() {
  const r = await fetch('/api/status')
  return r.json()
}
