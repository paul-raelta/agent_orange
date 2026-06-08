/* Agent Orange — Watchlist (default route, §5.1). At-a-glance status of every
   tracked company. */
import { useNavigate } from 'react-router-dom'
import { Btn, Conf, Delta, Glyph, Price, Spark, StatusChip } from '../components/primitives'
import { Loading } from '../components/Loading'
import { useCompanies, usePortfolioTotals } from '../hooks'
import { useShell } from '../layout/shellContext'
import type { Company } from '../types'

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}

export function Watchlist() {
  const { data: companies } = useCompanies()
  const { data: totals } = usePortfolioTotals()
  const { lastSync, running, runAll } = useShell()
  const navigate = useNavigate()

  if (!companies) return <Loading title="WATCHLIST" />

  const counts = companies.reduce<Record<string, number>>(
    (a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a),
    {},
  )

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">WATCHLIST</h1>
          <p className="screen-sub">
            {companies.length} agents ·{' '}
            <span className="s-watch">{counts.watching || 0} watching</span> ·{' '}
            <span className="s-review">{counts.review || 0} needs review</span> ·{' '}
            <span className="s-ok">{counts.validated || 0} validated</span>
          </p>
        </div>
        <div className="screen-actions">
          <span className="sync">last sync {lastSync}</span>
          <Btn kind="primary" sm onClick={runAll} icon={running ? '◴' : '▸'}>
            {running ? 'RUNNING…' : 'RUN ALL AGENTS'}
          </Btn>
        </div>
      </div>

      {totals && (
        <div className="pf-strip">
          <div className="pf-cell">
            <span className="lbl">PORTFOLIO</span>
            <span className="pf-val">{fmtMoney(totals.totalValue)}</span>
          </div>
          <div className="pf-cell">
            <span className="lbl">COST</span>
            <span className="pf-val pf-val-dim">{fmtMoney(totals.totalCost)}</span>
          </div>
          <div className="pf-cell">
            <span className="lbl">UNREALIZED</span>
            <span
              className={
                'pf-val ' + (totals.unrealized >= 0 ? 'delta-up' : 'delta-down')
              }
            >
              {totals.unrealized >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(totals.unrealized))}
              <span className="pf-pct">
                {' '}
                {totals.unrealized >= 0 ? '+' : '−'}
                {Math.abs(totals.unrealizedPct).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="wl-grid">
        {companies.map((c) => (
          <CompanyCard
            key={c.ticker}
            c={c}
            onOpen={() => navigate('/company/' + c.ticker)}
            onReview={() => navigate('/review')}
          />
        ))}
      </div>
    </div>
  )
}

function CompanyCard({
  c,
  onOpen,
  onReview,
}: {
  c: Company
  onOpen: () => void
  onReview: () => void
}) {
  const L = c.latest
  return (
    <article className={'wl-card status-' + c.status} onClick={onOpen}>
      <div className="wl-card-top">
        <div className="wl-id">
          <Glyph ticker={c.ticker} status={c.status} />
          <div>
            <div className="wl-ticker">{c.ticker}</div>
            <div className="wl-name">{c.name}</div>
          </div>
        </div>
        <StatusChip status={c.status} pulse />
      </div>

      <div className="wl-pricerow">
        <Price price={c.price} change={c.dayChange} />
        <Spark data={c.sparkEps} color="var(--accent)" />
      </div>

      {c.portfolio.shares > 0 && (
        <div className="wl-position">
          <span className="lbl">POSITION</span>
          <span className="wl-position-val">{fmtMoney(c.portfolio.value)}</span>
          <span
            className={
              'wl-position-pl ' +
              (c.portfolio.unrealized >= 0 ? 'delta-up' : 'delta-down')
            }
          >
            {c.portfolio.unrealized >= 0 ? '▲' : '▼'}{' '}
            {Math.abs(c.portfolio.unrealizedPct).toFixed(1)}%
          </span>
        </div>
      )}

      <div className="wl-period">
        <span className="wl-period-lab">
          {c.status === 'watching' ? 'LAST REPORTED' : 'LATEST'}
        </span>
        <span className="wl-period-val">{L.period}</span>
        <span className="wl-period-end">ended {L.periodEnd}</span>
      </div>

      <div className="wl-metrics">
        {L.metrics.slice(0, 3).map((m) => (
          <div className="wl-metric" key={m.key}>
            <div className="wl-metric-top">
              <span className="wl-metric-key">{m.key}</span>
              <Conf level={m.conf} />
            </div>
            <div className="wl-metric-val">{m.value}</div>
            <Delta value={m.yoy} />
          </div>
        ))}
      </div>

      <div className="wl-foot">
        {c.status === 'review' ? (
          <button
            className="wl-foot-cta review"
            onClick={(e) => {
              e.stopPropagation()
              onReview()
            }}
          >
            ⚑ 2 items need your review →
          </button>
        ) : c.status === 'watching' ? (
          <span className="wl-foot-note">
            <span className="chip-dot pulse" style={{ background: 'var(--amber)' }} />{' '}
            {c.nextWindow.label} · {c.nextWindow.from}–{c.nextWindow.to}
          </span>
        ) : (
          <span className="wl-foot-note ok">
            ✓ {L.validation.corroborations}× corroborated · validated {L.validatedOn}
          </span>
        )}
      </div>
    </article>
  )
}
