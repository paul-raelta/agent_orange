/* Agent Orange — Watchlist (default route, §5.1). At-a-glance status of every
   tracked company. */
import { useNavigate } from 'react-router-dom'
import { Btn, Conf, ConfidenceGauge, Delta, Glyph, Price, Spark, StatusChip } from '../components/primitives'
import { CountUp, Reveal, SkeletonCard } from '../motion/motion'
import { useCompanies, useFeatureFlags, usePortfolioTotals } from '../hooks'
import { useShell } from '../layout/shellContext'
import { isSupported } from '../data/supported'
import type { Company, FeatureFlags, MetricConsensus, PipelineRun } from '../types'

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

function fmtEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)}m`
}

function PipelineBadge({ run }: { run: PipelineRun }) {
  const eta = run.etaRemainingSeconds
  const label =
    run.state === 'queued'
      ? eta > 0
        ? `QUEUED · ~${fmtEta(eta)}`
        : 'QUEUED'
      : eta > 0
        ? `REFRESHING · ~${fmtEta(eta)}`
        : 'FINISHING…'
  return (
    <span
      className={'wl-pipeline-pill ' + run.state}
      title={
        run.state === 'queued'
          ? 'Pipeline waits its turn — running serially.'
          : 'Agents are extracting + validating + scoring this filing.'
      }
    >
      <span className="chip-dot pulse" />
      {label}
    </span>
  )
}

function BeatBadge({ kind, pct }: { kind: 'beat' | 'miss' | 'inline'; pct: number }) {
  const label = kind === 'beat' ? 'BEAT' : kind === 'miss' ? 'MISS' : 'IN LINE'
  return (
    <span
      className={'beat-badge ' + kind}
      title="Average earnings surprise vs Wall Street consensus across the latest metrics on this card. >+0.5% = BEAT, <−0.5% = MISS, otherwise IN LINE."
    >
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
  const supported = isSupported(c.ticker)
  // While status is `watching` and no metrics have been extracted yet, every
  // numeric on the card (price, day-change, sparkline, position value) is a
  // static seed value from sp500_seed.py — not real data. Hide them and
  // render an explicit "waiting" panel until the pipeline writes real rows.
  const awaitingAgents =
    supported && c.status === 'watching' && L.metrics.length === 0
  return (
    <article className={'wl-card status-' + c.status} onClick={onOpen}>
      <div className="wl-card-top">
        <div className="wl-id">
          <Glyph ticker={c.ticker} status={c.status} logoUrl={c.logoUrl} />
          <div>
            <div className="wl-ticker">{c.ticker}</div>
            <div className="wl-name">{c.name}</div>
          </div>
        </div>
        <div className="wl-card-top-right">
          {c.pipelineRun && <PipelineBadge run={c.pipelineRun} />}
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

      {!awaitingAgents && (
        <div className="wl-pricerow">
          <Price price={c.price} change={c.dayChange} />
          <Spark data={c.sparkEps} color="var(--accent)" />
        </div>
      )}

      {!awaitingAgents && c.portfolio.shares > 0 && (
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

      {awaitingAgents ? (
        <div className="wl-awaiting">
          <span className="wl-awaiting-dot" aria-hidden />
          <div className="wl-awaiting-copy">
            <div className="wl-awaiting-title">Waiting for agents</div>
            <div className="wl-awaiting-sub">
              Click RUN ALL AGENTS to fetch the latest filing, extract the
              headline figures, and populate price + reported metrics.
            </div>
          </div>
        </div>
      ) : supported ? (
        <>
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
                ⚑ {c.openReviewCount ?? 1}{' '}
                {(c.openReviewCount ?? 1) === 1 ? 'item' : 'items'} need your
                review →
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
        </>
      ) : (
        <div className="wl-unsupported">
          <span className="wl-unsupported-dot" aria-hidden />
          <div className="wl-unsupported-copy">
            <div className="wl-unsupported-title">Company not yet supported</div>
            <div className="wl-unsupported-sub">
              Detailed extraction and confidence coverage will land in a future release.
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
