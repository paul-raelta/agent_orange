/* Streaming POST /help/ask consumer.

   The backend returns SSE frames over a chunked POST response. EventSource
   only supports GET, so we read the response body with a ReadableStream
   reader and parse `event:` / `data:` lines ourselves. Each `delta` event
   carries `{ text: "..." }`; `error` / `done` close the stream. */

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

export type HelpHistory = { role: 'user' | 'assistant'; text: string }[]

export type StreamHandlers = {
  onDelta: (text: string) => void
  onError?: (message: string) => void
  onDone?: () => void
  signal?: AbortSignal
}

function parseFrame(block: string): { event: string; data: string } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  return { event, data: dataLines.join('\n') }
}

export async function askHelp(
  body: { question: string; screen?: string; history?: HelpHistory },
  handlers: StreamHandlers,
): Promise<void> {
  const r = await fetch(`${API_BASE}/help/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    credentials: 'omit',
    signal: handlers.signal,
  })
  if (!r.ok || !r.body) {
    handlers.onError?.(`Help request failed (${r.status})`)
    return
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  // Read until the response ends. The server flushes one SSE frame per delta;
  // we accumulate raw bytes into `buf`, split on the SSE frame delimiter
  // (\n\n), and dispatch each complete frame.
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const frame = parseFrame(block)
      if (!frame) continue
      try {
        const payload = JSON.parse(frame.data)
        if (frame.event === 'delta' && typeof payload.text === 'string') {
          handlers.onDelta(payload.text)
        } else if (frame.event === 'error') {
          handlers.onError?.(payload.message ?? 'unknown error')
        }
      } catch {
        /* malformed frame — ignore */
      }
    }
  }
  handlers.onDone?.()
}
