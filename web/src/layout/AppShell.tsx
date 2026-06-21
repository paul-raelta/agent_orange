/* Agent Orange — app shell: sidebar nav + usage meter + routed content (§5).
   Replaces the prototype's state-based router with React Router; the desktop/
   mobile toggle is dropped (prototype-only) — the layout is just responsive via
   the 700px container query on .app-shell.

   Also owns: the RUN ALL AGENTS feedback affordance (toast / held button /
   both), with the choice persisted in localStorage and exposed through the
   shell context so the Settings screen can change it. */
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { HelpAgent } from '../help/HelpAgent'
import { keys, useCompanies, useReviewQueue, useRunAll, useUsage } from '../hooks'
import { CountUp } from '../motion/motion'
import { TweaksPanel } from '../theme/TweaksPanel'
import type { RunFeedback, ShellContext } from './shellContext'

declare global {
  interface Window {
    AgentRun?: {
      start: (tickers?: string | string[]) => void
      reset: () => void
      hasRun: boolean
    }
    onAgentRunComplete?: () => void
  }
}

type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  external?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Watchlist', icon: '▦', end: true },
  { to: '/timeline', label: 'Timeline', icon: '▭' },
  { to: '/review', label: 'Review', icon: '⚑' },
  { to: '/companies', label: 'Companies', icon: '≣' },
  { to: '/activity', label: 'Activity', icon: '≁' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
  // Help is a self-contained static page in /public/help (vanilla HTML + JS +
  // annotated screenshots). NavLink would treat it as a SPA route and miss the
  // file; render as a plain <a> with target=_blank so the user keeps app state.
  { to: '/help/Help.html', label: 'Help', icon: '?', external: true },
]

const FEEDBACK_KEY = 'ao-run-feedback'
const HOLD_DURATION_MS = 3000

function loadFeedback(): RunFeedback {
  try {
    const v = localStorage.getItem(FEEDBACK_KEY)
    if (v === 'toast' || v === 'button' || v === 'both') return v
  } catch {
    /* ignore */
  }
  return 'both'
}

export function AppShell() {
  const qc = useQueryClient()
  const { data: reviewQueue } = useReviewQueue()
  const { data: usage } = useUsage()
  const { data: companies } = useCompanies()
  const runAllMutation = useRunAll()

  const [lastSync, setLastSync] = useState('Jul 30 · 09:12')
  const [holdRunning, setHoldRunning] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [runFeedback, setRunFeedbackState] = useState<RunFeedback>(loadFeedback)

  function setRunFeedback(v: RunFeedback) {
    setRunFeedbackState(v)
    try {
      localStorage.setItem(FEEDBACK_KEY, v)
    } catch {
      /* ignore quota */
    }
  }

  // Toast auto-dismisses after 4s.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Held-button state clears after HOLD_DURATION_MS.
  useEffect(() => {
    if (!holdRunning) return
    const t = setTimeout(() => setHoldRunning(false), HOLD_DURATION_MS)
    return () => clearTimeout(t)
  }, [holdRunning])

  const running = runAllMutation.isPending || holdRunning

  function runAll() {
    if (running) return
    const tickers = (companies ?? []).map((c) => c.ticker)
    if (!tickers.length) {
      setToast('Add a ticker to your watchlist first.')
      return
    }
    // Play the Document Examiner overlay alongside the backend kickoff. The
    // engine examines each watchlist ticker in sequence (~9.5s/chapter), then
    // refreshes companies so freshly extracted figures land on the watchlist.
    if (window.AgentRun) {
      window.onAgentRunComplete = () => {
        qc.invalidateQueries({ queryKey: keys.companies })
      }
      window.AgentRun.reset()
      window.AgentRun.start(tickers)
    }
    runAllMutation.mutate(undefined, {
      onSuccess: (res) => {
        setLastSync(res.lastSync)
        if (runFeedback === 'toast' || runFeedback === 'both') {
          setToast('Triggered. Check Activity for progress →')
        }
        if (runFeedback === 'button' || runFeedback === 'both') {
          setHoldRunning(true)
        }
      },
      onError: () => {
        setToast('Run failed — is the API up? Check workers/ console.')
      },
    })
  }

  const reviewCount = reviewQueue?.length ?? 0
  const ctx: ShellContext = { running, lastSync, runAll, runFeedback, setRunFeedback }

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="nav-brand">
          <span className="brand-mark" />
          <span className="brand-text">
            AGENT
            <br />
            <b>ORANGE</b>
          </span>
        </div>
        <ul className="nav-list">
          {NAV.map((n) =>
            n.external ? (
              <li key={n.to}>
                <a
                  href={n.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-item"
                >
                  <span className="nav-icon">{n.icon}</span>
                  <span className="nav-label">{n.label}</span>
                </a>
              </li>
            ) : (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                >
                  <span className="nav-icon">{n.icon}</span>
                  <span className="nav-label">{n.label}</span>
                  {n.label === 'Review' && reviewCount > 0 && (
                    <span className="nav-badge">{reviewCount}</span>
                  )}
                </NavLink>
              </li>
            )
          )}
        </ul>
        <div className="nav-foot">
          <div className="nav-usage">
            <div className="nu-top">
              <span>OPUS&nbsp;4</span>
              <span className="nu-dot" />
            </div>
            <div className="nu-bar">
              <span style={{ width: '37%' }} />
            </div>
            <div className="nu-lab">
              {usage ? <CountUp value={usage.monthCost} prefix="$" decimals={0} /> : '$–'}
              {' / '}${usage ? usage.budget : '–'} ·{' '}
              {usage ? <CountUp value={usage.monthTokens} decimals={0} suffix="M tok" /> : '–M tok'}
            </div>
          </div>
        </div>
      </nav>

      <main className="content">
        <Outlet context={ctx} />
      </main>

      {toast && (
        <div className="ao-toast" role="status">
          {toast}
          <button
            className="ao-toast-x"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <TweaksPanel />

      {/* Grounded in-app Help Assistant — floating launcher reachable on every
          screen. Posts to /help/ask, which streams a reply assembled from the
          help corpus (workers/ao/help/knowledge.py). */}
      <HelpAgent />
    </div>
  )
}
