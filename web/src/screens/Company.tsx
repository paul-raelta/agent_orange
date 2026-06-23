/* Agent Orange — Company deep-dive (company/:ticker, §5.2). Full history +
   validation + provenance for one company, plus AI narrative, portfolio editor,
   News + Insider tabs, and PLANNED tiles for future features. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTabInk } from '../motion/motion'
import {
  Btn,
  Conf,
  ConfidenceBreakdown,
  ConfidenceGauge,
  Delta,
  Drawer,
  Glyph,
  Panel,
  Price,
  ProvenanceItem,
  StatusChip,
} from '../components/primitives'
import { LogList } from '../components/LogList'
import { Loading } from '../components/Loading'
import {
  useActivity,
  useArchiveCompany,
  useCompany,
  useCompanySources,
  useFeatureFlags,
  useGuidance,
  useInsider,
  useNews,
  usePatchCompany,
  usePatchCompanySource,
  useResetCompanySource,
  useSetPosition,
} from '../hooks'
import type { HistoryRow, Metric } from '../types'

const BASE_TABS = ['results', 'validation', 'news', 'insider', 'agent runs'] as const
type Tab =
  | (typeof BASE_TABS)[number]
  | 'guidance'

const TAB_TIPS: Record<Tab, string> = {
  results:
    'Reported figures by quarter — revenue, net income, EPS and margins extracted from each 10-Q / 10-K.',
  validation:
    'How well each headline number was cross-checked across sources. Conflicts route to the REVIEW queue.',
  guidance:
    'Forward outlook (next quarter / full year) extracted from press releases and earnings calls. LABS feature.',
  news:
    'Recent headlines for this ticker — last 30 days, refreshed every 30 min from Finnhub.',
  insider:
    'Form 4 filings — officer / director / 10% holder buys and sells, newest first.',
  'agent runs':
    'Per-stage agent run log for this company (monitor → extract → validate → narrative → confidence).',
}

const ROWS: [string, keyof HistoryRow][] = [
  ['Revenue', 'rev'],
  ['Net income', 'ni'],
  ['EPS · diluted', 'epsD'],
  ['EPS · basic', 'epsB'],
  ['Gross margin', 'gm'],
]

const PLANNED_FEATURES = [
  { name: 'Forward guidance', desc: "Next-quarter / full-year revenue + EPS guidance from the press release." },
  { name: 'Segment breakdowns', desc: 'Revenue by segment, geography and product line.' },
  { name: 'Earnings transcripts', desc: 'Pull the call, summarize Q&A themes.' },
  { name: 'Consensus vs actual', desc: 'Beat / miss vs Wall Street estimates.' },
]

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}

export function Company() {
  const { ticker = '' } = useParams()
  const navigate = useNavigate()
  const { data: c, isLoading } = useCompany(ticker)
  const { data: activity } = useActivity(ticker)
  const { data: news } = useNews(ticker)
  const { data: insider } = useInsider(ticker)
  const setPosition = useSetPosition(ticker)
  const archive = useArchiveCompany()
  const { data: companySources } = useCompanySources(ticker)
  const patchCompanySource = usePatchCompanySource(ticker)
  const resetCompanySource = useResetCompanySource(ticker)
  const patchCompany = usePatchCompany(ticker)
  const { flags } = useFeatureFlags()
  const guidanceQuery = useGuidance(ticker, flags.guidance)
  const guidance = flags.guidance ? (c?.guidance ?? guidanceQuery.data ?? null) : null
  const tabs: Tab[] = flags.guidance
    ? ['results', 'validation', 'guidance', 'news', 'insider', 'agent runs']
    : [...BASE_TABS]
  const [tab, setTab] = useState<Tab>('results')
  useEffect(() => {
    if (!tabs.includes(tab)) setTab('results')
  }, [flags.guidance])  // eslint-disable-line react-hooks/exhaustive-deps
  const [prov, setProv] = useState<Metric | null>(null)
  const [showConfidence, setShowConfidence] = useState(false)
  const [irUrlInput, setIrUrlInput] = useState('')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [activeTabBtn, setActiveTabBtn] = useState<HTMLButtonElement | null>(null)
  useEffect(() => {
    setActiveTabBtn(tabRefs.current[tabs.indexOf(tab)] ?? null)
  }, [tab, isLoading, c, flags.guidance])  // eslint-disable-line react-hooks/exhaustive-deps
  const ink = useTabInk(activeTabBtn)

  function handleArchive() {
    if (!c) return
    if (!window.confirm(`Archive ${c.ticker}? It will be hidden from the watchlist; historical data is kept and you can restore it from /companies.`)) return
    archive.mutate(c.ticker, { onSuccess: () => navigate('/') })
  }

  // Local edit state for the portfolio inputs — synced from the loaded company
  // so users can type freely without each keystroke being committed.
  const [sharesInput, setSharesInput] = useState('')
  const [costInput, setCostInput] = useState('')
  useEffect(() => {
    if (c) {
      setSharesInput(String(c.portfolio.shares || ''))
      setCostInput(String(c.portfolio.costBasis || ''))
      setIrUrlInput(c.irUrl ?? '')
    }
  }, [c])

  function saveIrUrl() {
    const v = irUrlInput.trim()
    if (v && !(v.startsWith('https://') || v.startsWith('http://'))) {
      window.alert('IR URL must start with https://')
      return
    }
    patchCompany.mutate({ irUrl: v || null })
  }

  if (isLoading) return <Loading title={ticker} />
  if (!c) {
    return (
      <div className="screen">
        <button className="back" onClick={() => navigate('/')}>
          ← Watchlist
        </button>
        <Panel>
          <div className="empty">Unknown company “{ticker}”.</div>
        </Panel>
      </div>
    )
  }

  const L = c.latest
  const pf = c.portfolio

  const savePosition = () => {
    const shares = Number(sharesInput) || 0
    const costBasis = Number(costInput) || 0
    setPosition.mutate({ shares, costBasis })
  }

  return (
    <div className="screen">
      <button className="back" onClick={() => navigate('/')}>
        ← Watchlist
      </button>

      <div className="co-hd">
        <div className="wl-id">
          <Glyph ticker={c.ticker} status={c.status} logoUrl={c.logoUrl} />
          <div>
            <div className="co-ticker">
              {c.ticker} <span className="co-sector">{c.sector}</span>
            </div>
            <div className="wl-name">
              {c.name} · {c.cadence} · {c.fiscalNote}
            </div>
          </div>
        </div>
        <div className="co-hd-right">
          {c.confidence && (
            <ConfidenceGauge confidence={c.confidence} onClick={() => setShowConfidence(true)} />
          )}
          <Price price={c.price} change={c.dayChange} />
          <StatusChip status={c.status} pulse />
          <Btn kind="ghost" sm onClick={handleArchive} disabled={archive.isPending}>
            {archive.isPending ? 'ARCHIVING…' : 'ARCHIVE'}
          </Btn>
        </div>
      </div>

      <div className="co-srcrow">
        <span
          className="lbl"
          title="Data sources the agents fetch from for this company. Primary = the canonical source the extractor reads first."
        >
          SOURCES
        </span>
        {c.sources.map((s) => (
          <span
            key={s.label}
            className={'src-pill' + (s.primary ? ' primary' : '')}
            title={`${s.kind} source · ${s.label}${s.primary ? ' (primary)' : ''}`}
          >
            <b>{s.kind}</b> {s.label}
            {s.primary ? ' · primary' : ''}
          </span>
        ))}
        <span
          className="src-mode"
          title={
            c.sourceMode === 'auto'
              ? 'Source mode: AUTO — agent discovers IR + SEC sources automatically.'
              : 'Source mode: ' + c.sourceMode
          }
        >
          mode: {c.sourceMode}
        </span>
      </div>

      <Panel title="DATA SOURCES · per-company">
        <p className="panel-help">
          Each global data source can be enabled or disabled for {c.ticker} without
          affecting other tickers. An override here wins over the Settings → Data
          sources flag for this company.
        </p>
        {!companySources ? (
          <div className="empty">Loading sources…</div>
        ) : (
          <div className="ds-list">
            {companySources.map((src) => (
              <div
                className={'ds-row' + (src.effectiveEnabled ? '' : ' disabled')}
                key={src.id}
              >
                <span className={'ds-dot ' + (src.effectiveEnabled ? 'active' : 'planned')} />
                <div className="ds-id">
                  <b>{src.name}</b>
                  <span>{src.kind}</span>
                </div>
                <span className="cfg-mode">
                  {src.overridden ? 'per-company override' : 'global default'}
                </span>
                <span className="cfg-mode">
                  {src.effectiveEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <div className="cfg-actions">
                  <Btn
                    kind="ghost"
                    sm
                    onClick={() =>
                      patchCompanySource.mutate({
                        id: src.id,
                        enabled: !src.effectiveEnabled,
                      })
                    }
                    disabled={patchCompanySource.isPending}
                  >
                    {src.effectiveEnabled ? 'DISABLE' : 'ENABLE'}
                  </Btn>
                  {src.overridden && (
                    <Btn
                      kind="ghost"
                      sm
                      onClick={() => resetCompanySource.mutate(src.id)}
                      disabled={resetCompanySource.isPending}
                    >
                      RESET
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="add-row" style={{ marginTop: 12 }}>
          <span className="lbl">IR URL</span>
          <input
            className="inp"
            placeholder="https://investor.example.com/quarterly-results"
            value={irUrlInput}
            onChange={(e) => setIrUrlInput(e.target.value)}
          />
          <Btn
            kind="primary"
            sm
            onClick={saveIrUrl}
            disabled={patchCompany.isPending || irUrlInput === (c.irUrl ?? '')}
          >
            {patchCompany.isPending ? 'SAVING…' : 'SAVE'}
          </Btn>
        </div>
      </Panel>

      {c.narrative && (
        <div
          className="ai-narrative"
          title="AI-written 2-3 sentence summary of the headline takeaways from this filing, capped at 200 tokens. Generated after extraction + validation."
        >
          <span className="ai-narrative-lbl">WHAT'S WORTH KNOWING</span>
          <p className="ai-narrative-text">{c.narrative}</p>
        </div>
      )}

      <div className="pf-edit">
        <div className="pf-edit-field">
          <span className="lbl">SHARES</span>
          <input
            type="number"
            inputMode="decimal"
            value={sharesInput}
            onChange={(e) => setSharesInput(e.target.value)}
          />
        </div>
        <div className="pf-edit-field">
          <span className="lbl">COST BASIS / SHARE</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
          />
        </div>
        <Btn kind="primary" sm onClick={savePosition} disabled={setPosition.isPending}>
          {setPosition.isPending ? 'SAVING…' : 'SAVE'}
        </Btn>
        <div className="pf-edit-stats">
          <span className="lbl">POSITION</span>
          <span className="pf-edit-val">{fmtMoney(pf.value)}</span>
          <span className={pf.unrealized >= 0 ? 'delta-up' : 'delta-down'}>
            {pf.unrealized >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(pf.unrealized))} ·{' '}
            {pf.unrealized >= 0 ? '+' : '−'}
            {Math.abs(pf.unrealizedPct).toFixed(1)}%
          </span>
        </div>
      </div>

      {flags.consensus && <ConsensusBanner metrics={L.metrics} />}

      {c.status === 'review' && (
        <div className="banner banner-review">
          <span>⚑ This company has unresolved findings.</span>
          <Btn kind="review" sm onClick={() => navigate('/review')}>
            OPEN REVIEW QUEUE →
          </Btn>
        </div>
      )}

      <div className="tabs">
        {tabs.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            className={
              'tab' + (tab === t ? ' active' : '') + (t === 'guidance' ? ' tab-new' : '')
            }
            onClick={() => setTab(t)}
            title={TAB_TIPS[t]}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <span className="tab-ink" style={ink} />
      </div>

      {tab === 'results' && (
        <>
          <Panel
            title={'QUARTERLY RESULTS — last ' + c.history.length + ' periods'}
            pad={false}
          >
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th
                      className="sticky-col"
                      title="Headline GAAP figure extracted from the filing. Click a confidence badge below to see exactly where each number was read."
                    >
                      METRIC
                    </th>
                    {flags.consensus && (
                      <th
                        className="num cons-col"
                        title="CONSENSUS — the average Wall Street analyst estimate for this metric ahead of the print."
                      >
                        CONS
                      </th>
                    )}
                    {flags.consensus && (
                      <th
                        className="num"
                        title="SURPRISE % — (actual − estimate) / |estimate| × 100. Above +0.5% = beat (green), below −0.5% = miss (red)."
                      >
                        SURP
                      </th>
                    )}
                    {c.history.map((h, i) => (
                      <th
                        key={h.period}
                        title={
                          (i === 0 ? 'Latest reported period · ' : 'Prior period · ') +
                          h.period +
                          ' (ended ' +
                          h.end +
                          ')'
                        }
                      >
                        <div className="th-period">{h.period}</div>
                        <div className="th-end">{h.end}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, key]) => {
                    const lm = L.metrics.find((mm) => mm.key === label)
                    const cs = flags.consensus ? lm?.consensus : undefined
                    return (
                      <tr key={key}>
                        <td className="sticky-col rowlab">{label}</td>
                        {flags.consensus && (
                          <td className="num cons-col">{cs ? cs.estimateLabel : '—'}</td>
                        )}
                        {flags.consensus && (
                          <td
                            className={
                              'num ' +
                              (cs && cs.surprisePct > 0.3
                                ? 'delta-up'
                                : cs && cs.surprisePct < -0.3
                                  ? 'delta-down'
                                  : '')
                            }
                          >
                            {cs ? (cs.surprisePct >= 0 ? '+' : '') + cs.surprisePct.toFixed(1) + '%' : '—'}
                          </td>
                        )}
                        {c.history.map((h, i) => (
                          <td key={i} className={i === 0 ? 'cell-latest' : ''}>
                            <span className="cell-val">{h[key]}</span>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  <tr>
                    <td
                      className="sticky-col rowlab dim"
                      title="Per-metric extraction confidence (HIGH / MED / LOW) — derived from how many sources corroborate the number. Click a badge for the source quotes."
                    >
                      confidence
                    </td>
                    {flags.consensus && <td className="num cons-col">—</td>}
                    {flags.consensus && <td className="num">—</td>}
                    {c.history.map((h, i) => (
                      <td key={i} className={i === 0 ? 'cell-latest' : ''}>
                        <Conf
                          level={h.conf}
                          onClick={
                            i === 0 && L.metrics[2] ? () => setProv(L.metrics[2]) : undefined
                          }
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="tbl-note">
              Click a confidence badge on the latest column to inspect where each number was
              found.
            </div>
          </Panel>

          <div className="lbl" style={{ marginBottom: 8 }}>
            FUTURE FEATURES — PLANNED
          </div>
          <div className="planned-row">
            {PLANNED_FEATURES.map((p) => (
              <div className="planned-tile" key={p.name}>
                <div className="planned-tile-hd">
                  <span className="planned-tile-name">{p.name}</span>
                  <span className="planned-tile-badge">PLANNED</span>
                </div>
                <div className="planned-tile-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'validation' && (
        <Panel title="VALIDATION — latest period">
          <div className={'val-card ' + (L.validation.passed ? 'pass' : 'fail')}>
            <div className="val-top">
              <span
                className={'val-badge ' + (L.validation.passed ? 'pass' : 'fail')}
                title={
                  L.validation.passed
                    ? 'All extracted figures cleared the validation rule and corroborate across sources.'
                    : 'A figure failed the validation rule — open the Review queue to pick the correct value.'
                }
              >
                {L.validation.passed ? '✓ PASSED' : '⚑ NEEDS REVIEW'}
              </span>
              <span
                className="val-rule"
                title="The validation rule the extractor ran — checks GAAP / non-GAAP consistency and cross-source agreement."
              >
                rule · {L.validation.rule}
              </span>
            </div>
            <p className="val-detail">{L.validation.detail}</p>
            <div className="val-meta">
              <span
                title="How many distinct sources reported a matching figure for the headline metrics."
              >
                {L.validation.corroborations} corroborating source(s)
              </span>
              {L.validation.conflict && (
                <span
                  className="val-conflict"
                  title="At least one metric was reported differently across sources (e.g. GAAP vs non-GAAP EPS). Routed to REVIEW."
                >
                  value conflict detected
                </span>
              )}
            </div>
            {L.validation.demoSynthetic && (
              <div
                className="val-demo-note"
                title="This GAAP/non-GAAP conflict is fabricated in the demo fixture to exercise the REVIEW routing path. The underlying cached 10-Q has no such divergence — the extracted GAAP figures themselves are accurate."
              >
                <strong>DEMO ONLY · </strong>
                this conflict is synthetic — injected by the fixture so the
                REVIEW routing path stays demoable. The underlying 10-Q data
                is fine; the press-release "adjusted EPS" line does not exist
                in the real filing.
              </div>
            )}
          </div>
          <div className="metric-list">
            {L.metrics.map((m) => (
              <div
                className="metric-row"
                key={m.key}
                onClick={() => m.prov.length && setProv(m)}
                title={m.prov.length ? 'Click to view the exact source quotes for ' + m.key : undefined}
              >
                <span className="mr-key">{m.key}</span>
                <span className="mr-val">{m.value}</span>
                <Delta value={m.yoy} />
                <Conf level={m.conf} onClick={m.prov.length ? () => setProv(m) : undefined} />
                <span
                  className="mr-prov"
                  title="Number of corroborating sources where this figure was found"
                >
                  {m.prov.length} source{m.prov.length === 1 ? '' : 's'} ›
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'guidance' && flags.guidance && (
        <Panel title="FORWARD GUIDANCE">
          <p className="gd-intro">
            Forward outlook extracted from management commentary and earnings calls,
            tracked vs. prior guidance. Every range links back to the exact sentence.
          </p>
          {!guidance || guidance.length === 0 ? (
            <div className="gd-empty">
              {guidanceQuery.isLoading
                ? 'Loading guidance…'
                : 'No forward guidance extracted yet. The extractor will populate this on the next earnings call.'}
            </div>
          ) : (
            guidance.map((g) => {
              const dirMap: Record<
                'raised' | 'cut' | 'maintained',
                { label: string; color: string }
              > = {
                raised: { label: 'RAISED ▲', color: 'var(--green)' },
                cut: { label: 'CUT ▼', color: 'var(--red)' },
                maintained: { label: 'MAINTAINED', color: 'var(--text-2)' },
              }
              const d = dirMap[g.direction]
              return (
                <div className="gd-row" key={g.metric + g.period}>
                  <div className="gd-top">
                    <span className="gd-metric">{g.metric}</span>
                    <span className="gd-period">{g.period}</span>
                    <span
                      className="gd-dir"
                      style={{ color: d.color, borderColor: d.color }}
                    >
                      {d.label}
                    </span>
                  </div>
                  <div className="gd-range">
                    <span className="gd-now">
                      {g.low}–{g.high}
                    </span>
                    {g.prior && <span className="gd-prior">was {g.prior}</span>}
                  </div>
                  <div className="gd-prov">
                    ▸ "{g.provenance.snippet}" ·{' '}
                    {g.provenance.url ? (
                      <a href={g.provenance.url} target="_blank" rel="noopener noreferrer">
                        {g.provenance.page || 'source'} ↗
                      </a>
                    ) : (
                      g.provenance.page || 'source'
                    )}
                  </div>
                </div>
              )
            })
          )}
        </Panel>
      )}

      {tab === 'news' && (
        <Panel title={'RECENT NEWS — last 30 days'} pad={false}>
          {!news || news.length === 0 ? (
            <div className="empty">No news yet. Finnhub will populate this on the next poll.</div>
          ) : (
            <div className="news-list">
              {news.map((n, i) => (
                <div className="news-row" key={i}>
                  <span className="news-t">{n.ts}</span>
                  <span className="news-src">{n.source}</span>
                  <div className="news-body">
                    <a
                      className="news-headline"
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {n.headline}
                    </a>
                    {n.summary && <div className="news-summary">{n.summary}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'insider' && (
        <Panel title="INSIDER TRANSACTIONS — Form 4" pad={false}>
          {!insider || insider.length === 0 ? (
            <div className="empty">
              No insider transactions yet. Finnhub will populate this on the next poll.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="insider-tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Insider</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th className="num">Shares</th>
                    <th className="num">Price</th>
                    <th className="num">Value</th>
                    <th>Filing</th>
                  </tr>
                </thead>
                <tbody>
                  {insider.map((ix, i) => (
                    <tr key={i}>
                      <td>{ix.ts}</td>
                      <td>{ix.insider}</td>
                      <td>{ix.role}</td>
                      <td className={ix.type === 'BUY' ? 'tx-buy' : 'tx-sell'}>{ix.type}</td>
                      <td className="num">{ix.shares.toLocaleString()}</td>
                      <td className="num">${ix.price.toFixed(2)}</td>
                      <td className="num">{fmtMoney(ix.value)}</td>
                      <td>
                        <a
                          href={ix.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue)' }}
                        >
                          ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'agent runs' && (
        <Panel title="AGENT RUNS — this company" pad={false}>
          <LogList rows={activity ?? []} />
        </Panel>
      )}

      <Drawer
        open={showConfidence}
        onClose={() => setShowConfidence(false)}
        title="FINANCIAL CONFIDENCE"
      >
        {c.confidence ? (
          <ConfidenceBreakdown confidence={c.confidence} />
        ) : (
          <p className="drawer-help">No confidence assessment yet.</p>
        )}
      </Drawer>

      <Drawer
        open={!!prov}
        onClose={() => setProv(null)}
        title={prov ? 'PROVENANCE · ' + prov.key : ''}
      >
        {prov && (
          <>
            <div className="drawer-metric">
              <span className="dm-val">{prov.value}</span>
              <Conf level={prov.conf} />
              <span className="dm-yoy">
                <Delta value={prov.yoy} /> YoY
              </span>
            </div>
            <p className="drawer-help">
              Every figure links back to the exact place the agent read it. Multiple agreeing
              sources raise confidence; conflicts drop it and route to review.
            </p>
            {prov.prov.length ? (
              prov.prov.map((p, i) => <ProvenanceItem key={i} p={p} />)
            ) : (
              <p className="drawer-help">No source captured.</p>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}

function ConsensusBanner({ metrics }: { metrics: Metric[] }) {
  const priced = metrics.filter((m) => m.consensus)
  if (priced.length === 0) return null
  const eps = priced.find((m) => m.key.toLowerCase().includes('eps')) ?? priced[0]
  const epsSurprise = eps.consensus!.surprisePct
  const above = priced.filter((m) => m.consensus!.surprisePct > 0).length
  const kind = epsSurprise > 0.5 ? 'beat' : epsSurprise < -0.5 ? 'miss' : 'inline'
  const label = kind === 'beat' ? 'BEAT' : kind === 'miss' ? 'MISS' : 'IN LINE'
  return (
    <div className={'co-cons-banner' + (kind === 'miss' ? ' miss' : '')}>
      <span
        className={'beat-badge ' + kind}
        title="Headline EPS vs Wall Street consensus estimate. >+0.5% = BEAT, <−0.5% = MISS, otherwise IN LINE."
      >
        {label} {epsSurprise >= 0 ? '+' : ''}{epsSurprise.toFixed(1)}%
      </span>
      <span className="co-cons-banner-tx">
        <b>
          {eps.key} {eps.value}
        </b>{' '}
        vs {eps.consensus!.estimateLabel} consensus
        {priced.length > 1 && (
          <>
            {' — '}
            {above} of {priced.length} metric{priced.length === 1 ? '' : 's'} above estimate.
          </>
        )}
      </span>
    </div>
  )
}
