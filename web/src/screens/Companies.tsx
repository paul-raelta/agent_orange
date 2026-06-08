/* Agent Orange — Companies config (companies, §5.5). Configure tracked companies
   + add new ones via a MINIMAL/ADVANCED discovery flow (§7). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Glyph, Panel, StatusChip } from '../components/primitives'
import { Loading } from '../components/Loading'
import { useCompanies, useDiscover } from '../hooks'

const METRICS = ['Revenue', 'Net income', 'EPS basic', 'EPS diluted', 'Gross margin', 'Guidance']

export function Companies() {
  const { data: companies } = useCompanies()
  const navigate = useNavigate()
  const discover = useDiscover()

  const [adding, setAdding] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [ticker, setTicker] = useState('')

  const phase = discover.isPending ? 'discovering' : discover.data ? 'found' : 'idle'

  function startDiscovery() {
    if (!ticker.trim()) return
    discover.mutate(ticker)
  }
  function reset() {
    setAdding(false)
    setAdvanced(false)
    setTicker('')
    discover.reset()
  }

  if (!companies) return <Loading title="COMPANIES" />

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">COMPANIES</h1>
          <p className="screen-sub">
            Configure which companies the agents track, where to look, and how strict validation is.
          </p>
        </div>
        {!adding && (
          <Btn kind="primary" sm icon="+" onClick={() => setAdding(true)}>
            ADD COMPANY
          </Btn>
        )}
      </div>

      {adding && (
        <Panel
          title="ADD COMPANY"
          right={
            <button className="x-btn" onClick={reset}>
              ✕
            </button>
          }
        >
          <div className="add-mode">
            <span className="lbl">SETUP</span>
            <div className="seg">
              <button className={!advanced ? 'active' : ''} onClick={() => setAdvanced(false)}>
                MINIMAL
              </button>
              <button className={advanced ? 'active' : ''} onClick={() => setAdvanced(true)}>
                ADVANCED
              </button>
            </div>
            <span className="add-mode-note">
              {advanced ? 'Pin sources & tune validation.' : 'Just a ticker — the agent finds the rest.'}
            </span>
          </div>

          <div className="add-row">
            <input
              className="inp"
              placeholder="Ticker (e.g. AMD)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startDiscovery()}
            />
            <Btn kind="primary" sm onClick={startDiscovery} disabled={phase === 'discovering'}>
              {phase === 'discovering' ? 'DISCOVERING…' : 'DISCOVER SOURCES'}
            </Btn>
          </div>

          {phase === 'discovering' && (
            <ul className="disco">
              <li className="ok">✓ Resolved ticker → company name</li>
              <li className="ok">✓ Located SEC EDGAR CIK</li>
              <li className="run">◴ Scanning investor-relations site…</li>
              <li className="wait">· Inferring reporting cadence</li>
            </ul>
          )}

          {phase === 'found' && discover.data && (
            <>
              <div className="banner banner-ok">
                <span>✓ Sources found. Confirm to start watching.</span>
              </div>
              <div className="kv">
                <div>
                  <span className="lbl">PRIMARY IR</span>
                  <span>{discover.data.ir}</span>
                </div>
                <div>
                  <span className="lbl">SEC</span>
                  <span>{discover.data.sec}</span>
                </div>
                <div>
                  <span className="lbl">CADENCE</span>
                  <span>{discover.data.cadence}</span>
                </div>
                <div>
                  <span className="lbl">NEXT WINDOW</span>
                  <span>{discover.data.window}</span>
                </div>
              </div>

              {advanced && (
                <div className="adv-block">
                  <div className="adv-hd">ADVANCED GUIDANCE</div>
                  <label className="adv-field">
                    <span>Pinned source URL (optional)</span>
                    <input className="inp" placeholder="https://…/quarterly-results" />
                  </label>
                  <label className="adv-field">
                    <span>Reporting cadence</span>
                    <select className="inp">
                      <option>Quarterly (4×/yr)</option>
                      <option>Semi-annual (2×/yr)</option>
                      <option>Auto-detect</option>
                    </select>
                  </label>
                  <label className="adv-field">
                    <span>Metrics to extract</span>
                    <div className="taglist">
                      {METRICS.map((m, i) => (
                        <span key={m} className={'tag' + (i < 4 ? ' on' : '')}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </label>
                  <label className="adv-field">
                    <span>Validation rule</span>
                    <select className="inp">
                      <option>Cross-reference EPS in ≥2 locations</option>
                      <option>Match press release to 8-K schedule</option>
                      <option>None (record as-found)</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="add-confirm">
                <Btn kind="primary" onClick={reset} icon="▸">
                  START WATCHING {ticker.toUpperCase()}
                </Btn>
                <Btn kind="ghost" onClick={reset}>
                  Cancel
                </Btn>
              </div>
            </>
          )}
        </Panel>
      )}

      <div className="cfg-list">
        {companies.map((c) => (
          <div className="cfg-row" key={c.ticker} onClick={() => navigate('/company/' + c.ticker)}>
            <Glyph ticker={c.ticker} status={c.status} />
            <div className="cfg-id">
              <b>{c.ticker}</b>
              <span>{c.name}</span>
            </div>
            <div className="cfg-src">
              {c.sources.map((s) => (
                <span key={s.label} className="src-pill sm">
                  <b>{s.kind}</b> {s.label}
                </span>
              ))}
            </div>
            <span className="cfg-cad">{c.cadence}</span>
            <span className="cfg-mode">mode: {c.sourceMode}</span>
            <StatusChip status={c.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
