/* Agent Orange — app shell: sidebar nav + usage meter + routed content (§5).
   Replaces the prototype's state-based router with React Router; the desktop/
   mobile toggle is dropped (prototype-only) — the layout is just responsive via
   the 700px container query on .app-shell. */
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useReviewQueue, useRunAll, useUsage } from '../hooks'
import { TweaksPanel } from '../theme/TweaksPanel'
import type { ShellContext } from './shellContext'

const NAV = [
  { to: '/', label: 'Watchlist', icon: '▦', end: true },
  { to: '/timeline', label: 'Timeline', icon: '▭' },
  { to: '/review', label: 'Review', icon: '⚑' },
  { to: '/companies', label: 'Companies', icon: '≣' },
  { to: '/activity', label: 'Activity', icon: '≁' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell() {
  const { data: reviewQueue } = useReviewQueue()
  const { data: usage } = useUsage()
  const runAllMutation = useRunAll()

  const [lastSync, setLastSync] = useState('Jul 30 · 09:12')
  const running = runAllMutation.isPending

  function runAll() {
    if (running) return
    runAllMutation.mutate(undefined, {
      onSuccess: (res) => setLastSync(res.lastSync),
    })
  }

  const reviewCount = reviewQueue?.length ?? 0
  const ctx: ShellContext = { running, lastSync, runAll }

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
          {NAV.map((n) => (
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
          ))}
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
              ${usage ? usage.monthCost.toFixed(0) : '–'} / ${usage ? usage.budget : '–'} ·{' '}
              {usage ? usage.monthTokens : '–'}M tok
            </div>
          </div>
        </div>
      </nav>

      <main className="content">
        <Outlet context={ctx} />
      </main>

      <TweaksPanel />
    </div>
  )
}
