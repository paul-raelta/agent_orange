/* Agent Orange — Help Assistant.

   A grounded chat panel that lives on every screen. The backend
   (POST /help/ask) injects the full help corpus into the system prompt so
   answers come ONLY from verified facts — this component is just the chat UI.

   Reachable everywhere via a floating launcher (bottom-right). Open/closed
   persists in localStorage. The current route auto-fills the `screen` field
   so the model knows where the user is. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HELP_STARTERS } from './starters'
import { screenLabelForPath } from './screen'
import { askHelp, type HelpHistory } from './stream'

type Msg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; streaming?: boolean }

const OPEN_KEY = 'ao-help-open'

function loadOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function saveOpen(v: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, v ? '1' : '0')
  } catch {
    /* ignore quota */
  }
}

/* Tiny markdown formatter — same shape as the prototype's `format()`:
   - `**bold**` spans
   - `- item` and `1. item` lines fold into a single numbered list
   - everything else becomes a paragraph */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
}

function formatText(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  let html = ''
  let inList = false
  for (const line of lines) {
    const li = line.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)/)
    if (li) {
      if (!inList) {
        html += '<ol class="ha-ol">'
        inList = true
      }
      html += `<li>${inline(li[1])}</li>`
    } else {
      if (inList) {
        html += '</ol>'
        inList = false
      }
      html += `<p>${inline(line)}</p>`
    }
  }
  if (inList) html += '</ol>'
  return html
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === 'user') {
    return (
      <div className="ha-msg ha-user">
        <div className="ha-b">{m.text}</div>
      </div>
    )
  }
  const html =
    m.streaming && !m.text
      ? '<span class="ha-dots"><i></i><i></i><i></i></span>'
      : formatText(m.text || '')
  return (
    <div className="ha-msg ha-bot">
      <div className="ha-ava">◑</div>
      <div className="ha-b" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export function HelpAgent() {
  const location = useLocation()
  const screen = useMemo(() => screenLabelForPath(location.pathname), [location.pathname])

  const [open, setOpen] = useState<boolean>(loadOpen)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      text:
        'Hi! I’m the Agent Orange help assistant. Ask me anything about using the site — adding companies, what a status means, how numbers get validated, controlling cost, and more.',
    },
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    saveOpen(open)
  }, [open])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, open])

  // Cancel any in-flight stream when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return

    setInput('')

    // Snapshot the history we send to the backend BEFORE adding the new
    // turn, so the request shape matches the prototype (history = prior
    // turns; question = the new one).
    const history: HelpHistory = msgs
      .filter((m) => !('streaming' in m && m.streaming))
      .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text }))

    const userMsg: Msg = { role: 'user', text: q }
    const placeholder: Msg = { role: 'assistant', text: '', streaming: true }
    setMsgs((prev) => [...prev, userMsg, placeholder])
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller
    try {
      await askHelp(
        { question: q, screen, history },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            setMsgs((prev) => {
              const next = prev.slice()
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i]
                if (m.role === 'assistant' && 'streaming' in m && m.streaming) {
                  next[i] = { role: 'assistant', text: (m.text || '') + delta, streaming: true }
                  return next
                }
              }
              return prev
            })
          },
          onError: (msg) => {
            setMsgs((prev) => {
              const next = prev.slice()
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i]
                if (m.role === 'assistant' && 'streaming' in m && m.streaming) {
                  next[i] = {
                    role: 'assistant',
                    text:
                      'I’m having trouble reaching the assistant right now. Please try again in a moment — or check the **Help** guide.',
                  }
                  return next
                }
              }
              return prev
            })
            // eslint-disable-next-line no-console
            console.warn('help-ask error:', msg)
          },
        },
      )
    } finally {
      setMsgs((prev) => {
        const next = prev.slice()
        for (let i = next.length - 1; i >= 0; i--) {
          const m = next[i]
          if (m.role === 'assistant' && 'streaming' in m && m.streaming) {
            // Strip the streaming marker; preserve whatever text accumulated.
            next[i] = {
              role: 'assistant',
              text:
                m.text?.trim() ||
                'Sorry — I didn’t catch that. Could you rephrase?',
            }
            return next
          }
        }
        return prev
      })
      setBusy(false)
      abortRef.current = null
    }
  }

  const showStarters = msgs.filter((m) => m.role === 'user').length === 0

  if (!open) {
    return (
      <button
        className="ha-launch"
        onClick={() => setOpen(true)}
        aria-label="Open help assistant"
      >
        <span className="ha-launch-i">◑</span>
        <span className="ha-launch-tx">Need help?</span>
      </button>
    )
  }

  return (
    <div className="ha-panel" role="dialog" aria-label="Help assistant">
      <div className="ha-hd">
        <div className="ha-hd-l">
          <span className="ha-mark">◑</span>
          <div>
            <div className="ha-title">HELP ASSISTANT</div>
            <div className="ha-sub">Ask about using Agent Orange</div>
          </div>
        </div>
        <button className="ha-x" onClick={() => setOpen(false)} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="ha-ctx">
        <span className="ha-ctx-l">You’re on</span>
        <span className="ha-ctx-v">{screen}</span>
        <span className="ha-ctx-h">answers adapt to your screen</span>
      </div>

      <div className="ha-body" ref={scrollRef}>
        {msgs.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {showStarters && (
          <div className="ha-starters">
            {HELP_STARTERS.map((s) => (
              <button key={s} className="ha-chip" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="ha-input"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? 'Thinking…' : 'Ask a question…'}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          ↑
        </button>
      </form>
      <div className="ha-foot">
        Grounded in the Agent Orange help guide · not investment advice
      </div>
    </div>
  )
}
