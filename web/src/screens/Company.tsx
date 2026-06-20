/* Agent Orange — Company deep-dive (company/:ticker, §5.2). Full history +
   validation + provenance for one company, plus AI narrative, portfolio editor,
   News + Insider tabs, and PLANNED tiles for future features. */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Btn,
  Conf,
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
  useInsider,
  useNews,
  usePatchCompany,
  usePatchCompanySource,
  useResetCompanySource,
  useSetPosition,
} from '../hooks'
import type { HistoryRow, Metric } from '../types'

const TABS = ['results', 'validation', 'news', 'insider', 'agent runs'] as const
type Tab = (typeof TABS)[number]

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
  const [tab, setTab] = useState<Tab>('results')
  const [prov, setProv] = useState<Metric | null>(null)
  const [irUrlInput, setIrUrlInput] = useState('')

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
          <Glyph ticker={c.ticker} status={c.status} />
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
          <Price price={c.price} change={c.dayChange} />
          <StatusChip status={c.status} pulse />
          <Btn kind="ghost" sm onClick={handleArchive} disabled={archive.isPending}>
            {archive.isPending ? 'ARCHIVING…' : 'ARCHIVE'}
          </Btn>
        </div>
      </div>

      <div className="co-srcrow">
        <span className="lbl">SOURCES</span>
        {c.sources.map((s) => (
          <span key={s.label} className={'src-pill' + (s.primary ? ' primary' : '')}>
            <b>{s.kind}</b> {s.label}
            {s.primary ? ' · primary' : ''}
          </span>
        ))}
        <span className="src-mode">mode: {c.sourceMode}</span>
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
        <div className="ai-narrative">
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

      {c.status === 'review' && (
        <div className="banner banner-review">
          <span>⚑ This company has unresolved findings.</span>
          <Btn kind="review" sm onClick={() => navigate('/review')}>
            OPEN REVIEW QUEUE →
          </Btn>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={'tab' + (tab === t ? ' active' : '')}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
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
                    <th className="sticky-col">METRIC</th>
                    {c.history.map((h) => (
                      <th key={h.period}>
                        <div className="th-period">{h.period}</div>
                        <div className="th-end">{h.end}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, key]) => (
                    <tr key={key}>
                      <td className="sticky-col rowlab">{label}</td>
                      {c.history.map((h, i) => (
                        <td key={i} className={i === 0 ? 'cell-latest' : ''}>
                          <span className="cell-val">{h[key]}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky-col rowlab dim">confidence</td>
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
              <span className={'val-badge ' + (L.validation.passed ? 'pass' : 'fail')}>
                {L.validation.passed ? '✓ PASSED' : '⚑ NEEDS REVIEW'}
              </span>
              <span className="val-rule">rule · {L.validation.rule}</span>
            </div>
            <p className="val-detail">{L.validation.detail}</p>
            <div className="val-meta">
              <span>{L.validation.corroborations} corroborating source(s)</span>
              {L.validation.conflict && (
                <span className="val-conflict">value conflict detected</span>
              )}
            </div>
          </div>
          <div className="metric-list">
            {L.metrics.map((m) => (
              <div
                className="metric-row"
                key={m.key}
                onClick={() => m.prov.length && setProv(m)}
              >
                <span className="mr-key">{m.key}</span>
                <span className="mr-val">{m.value}</span>
                <Delta value={m.yoy} />
                <Conf level={m.conf} onClick={m.prov.length ? () => setProv(m) : undefined} />
                <span className="mr-prov">
                  {m.prov.length} source{m.prov.length === 1 ? '' : 's'} ›
                </span>
              </div>
            ))}
          </div>
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
