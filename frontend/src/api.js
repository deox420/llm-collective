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

// Lee un cuerpo SSE (fetch streaming) y llama onEvent por cada evento.
async function consumeSSE(res, onEvent) {
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

function throwIfBusy(res) {
  if (res.status === 409) return res.json().then((b) => {
    throw new ModeBusyError(b?.error?.active_mode)
  })
  if (!res.ok || !res.body) throw new Error(`http_error_${res.status}`)
}

// Lanza el flujo SSE de demo de un modo (Fase 2: devteam/brain de momento).
export async function runMode(mode, { onOpen, onEvent } = {}) {
  const res = await fetch(`/api/demo/${mode}/run`, { method: 'POST' })
  await throwIfBusy(res)
  onOpen && onOpen()
  await consumeSSE(res, onEvent)
}

// Crea una conversación y devuelve su id.
export async function createConversation(project) {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  })
  if (!res.ok) throw new Error(`create_conversation_${res.status}`)
  return res.json()
}

// Lanza una consulta real al Council (SSE). onEvent recibe los eventos de etapa
// (stage1_opinion, stage2_review, stage3_final, stage:start/done, session:done…).
export async function runCouncilQuery(conversationId, content, { onEvent } = {}) {
  const res = await fetch(`/api/council/${conversationId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  await throwIfBusy(res)
  await consumeSSE(res, onEvent)
}

// Lanza una tarea real al Dev Team (SSE): role_start/role_output/tool_call/
// test_result/loop_back/delivery + stage:start/done.
export async function runDevteamTask(conversationId, content, { onEvent, maxIterations } = {}) {
  const res = await fetch(`/api/devteam/${conversationId}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, max_iterations: maxIterations }),
  })
  await throwIfBusy(res)
  await consumeSSE(res, onEvent)
}

// Consulta RAG real al Second Brain (SSE): retrieved → answer → citations.
export async function runBrainQuery(conversationId, content, { onEvent, topK } = {}) {
  const res = await fetch(`/api/secondbrain/${conversationId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, top_k: topK || 6 }),
  })
  await throwIfBusy(res)
  await consumeSSE(res, onEvent)
}

export async function fetchHealth() {
  const r = await fetch('/api/health')
  return r.json()
}

export async function fetchStatus() {
  const r = await fetch('/api/status')
  return r.json()
}
