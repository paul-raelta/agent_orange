/* Agent Orange — Watchlist (default route, §5.1). At-a-glance status of every
   tracked company. */
import { useNavigate } from 'react-router-dom'
import { Btn, Conf, ConfidenceGauge, Delta, Glyph, Price, Spark, StatusChip } from '../components/primitives'
import { CountUp, Reveal, SkeletonCard } from '../motion/motion'
import { useCompanies, useFeatureFlags, usePortfolioTotals } from '../hooks'
import { useShell } from '../layout/shellContext'
import type { Company, FeatureFlags, MetricConsensus } from '../types'

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}

function moneyScale(n: number): { divisor: number; suffix: string } {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return { divisor: 1_000_000, suffix: 'M' }
  if (abs >= 1_000) return { divisor: 1_000, suffix: 'k' }
  return { divisor: 1, suffix: '' }
}

function AnimatedMoney({ value }: { value: number }) {
  const { divisor, suffix } = moneyScale(value)
  return <CountUp value={value / divisor} prefix="$" suffix={suffix} decimals={2} />
}

export function Watchlist() {
  const { data: companies } = useCompanies()
  const { data: totals } = usePortfolioTotals()
  const { flags } = useFeatureFlags()
  const { lastSync, running, runAll } = useShell()
  const navigate = useNavigate()

  if (!companies) {
    return (
      <div className="screen">
        <div className="screen-hd">
          <div>
            <h1 className="screen-title">WATCHLIST</h1>
            <p className="screen-sub">Loading…</p>
          </div>
        </div>
        <div className="wl-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

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
            <span className="pf-val"><AnimatedMoney value={totals.totalValue} /></span>
          </div>
          <div className="pf-cell">
            <span className="lbl">COST</span>
            <span className="pf-val pf-val-dim"><AnimatedMoney value={totals.totalCost} /></span>
          </div>
          <div className="pf-cell">
            <span className="lbl">UNREALIZED</span>
            <span
              className={
                'pf-val ' + (totals.unrealized >= 0 ? 'delta-up' : 'delta-down')
              }
            >
              {totals.unrealized >= 0 ? '▲' : '▼'}{' '}
              <AnimatedMoney value={Math.abs(totals.unrealized)} />
              <span className="pf-pct">
                {' '}
                {totals.unrealized >= 0 ? '+' : '−'}
                <CountUp value={Math.abs(totals.unrealizedPct)} decimals={1} suffix="%" />
              </span>
            </span>
          </div>
        </div>
      )}

      <Reveal className="wl-grid mo-fadein">
        {companies.map((c) => (
          <CompanyCard
            key={c.ticker}
            c={c}
            flags={flags}
            onOpen={() => navigate('/company/' + c.ticker)}
            onReview={() => navigate('/review')}
          />
        ))}
      </Reveal>
    </div>
  )
}

/* Aggregate a card-level beat/miss summary across the three latest metrics
   that carry consensus. Returns null when no metric is priced — caller falls
   back to the existing StatusChip. */
function cardBeatSummary(
  metrics: { consensus?: MetricConsensus }[],
): { kind: 'beat' | 'miss' | 'inline'; pct: number } | null {
  const priced = metrics
    .map((m) => m.consensus?.surprisePct)
    .filter((v): v is number => typeof v === 'number')
  if (priced.length === 0) return null
  const avg = priced.reduce((s, v) => s + v, 0) / priced.length
  if (avg > 0.5) return { kind: 'beat', pct: avg }
  if (avg < -0.5) return { kind: 'miss', pct: avg }
  return { kind: 'inline', pct: avg }
}

function BeatBadge({ kind, pct }: { kind: 'beat' | 'miss' | 'inline'; pct: number }) {
  const label = kind === 'beat' ? 'BEAT' : kind === 'miss' ? 'MISS' : 'IN LINE'
  return (
    <span className={'beat-badge ' + kind}>
      {label} {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function CompanyCard({
  c,
  flags,
  onOpen,
  onReview,
}: {
  c: Company
  flags: FeatureFlags
  onOpen: () => void
  onReview: () => void
}) {
  const L = c.latest
  const beat = flags.consensus ? cardBeatSummary(L.metrics) : null
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
        <div className="wl-card-top-right">
          {c.confidence && (
            <ConfidenceGauge
              confidence={c.confidence}
              compact
              onClick={onOpen}
            />
          )}
          {beat ? <BeatBadge kind={beat.kind} pct={beat.pct} /> : <StatusChip status={c.status} pulse />}
        </div>
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
        {L.metrics.slice(0, 3).map((m) => {
          const cs = flags.consensus ? m.consensus : undefined
          const surpClass =
            cs ? (cs.surprisePct > 0.3 ? 'up' : cs.surprisePct < -0.3 ? 'down' : 'flat') : ''
          return (
            <div className="wl-metric" key={m.key}>
              <div className="wl-metric-top">
                <span className="wl-metric-key">{m.key}</span>
                <Conf level={m.conf} />
              </div>
              <div className="wl-metric-val">{m.value}</div>
              {cs ? (
                <div className={'wl-metric-surp ' + surpClass}>
                  {cs.surprisePct >= 0 ? '+' : ''}
                  {cs.surprisePct.toFixed(1)}% vs est
                </div>
              ) : (
                <Delta value={m.yoy} />
              )}
            </div>
          )
        })}
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
