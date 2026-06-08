/* Agent Orange — Company deep-dive (company/:ticker, §5.2). Full history +
   validation + provenance for one company. */
import { useState } from 'react'
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
import { useActivity, useCompany } from '../hooks'
import type { HistoryRow, Metric } from '../types'

const TABS = ['results', 'validation', 'agent runs'] as const
type Tab = (typeof TABS)[number]

const ROWS: [string, keyof HistoryRow][] = [
  ['Revenue', 'rev'],
  ['Net income', 'ni'],
  ['EPS · diluted', 'epsD'],
  ['EPS · basic', 'epsB'],
  ['Gross margin', 'gm'],
]

export function Company() {
  const { ticker = '' } = useParams()
  const navigate = useNavigate()
  const { data: c, isLoading } = useCompany(ticker)
  const { data: activity } = useActivity(ticker)
  const [tab, setTab] = useState<Tab>('results')
  const [prov, setProv] = useState<Metric | null>(null)

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
        <Panel title={'QUARTERLY RESULTS — last ' + c.history.length + ' periods'} pad={false}>
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
                        onClick={i === 0 ? () => setProv(L.metrics[2]) : undefined}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="tbl-note">
            Click a confidence badge on the latest column to inspect where each number was found.
          </div>
        </Panel>
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
              {L.validation.conflict && <span className="val-conflict">value conflict detected</span>}
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
