/* Agent Orange — Filing Timeline (timeline, §5.3). Predicted filing windows +
   live watching state across a months-across track. Lanes are derived from the
   active watchlist — archived/removed companies disappear here too. */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Glyph, Panel, StatusChip } from '../components/primitives'
import { useCompanies } from '../hooks'
import type { Company } from '../types'
import type { Status } from '../components/status'

type Bar =
  | { type: 'reported'; at: number; label: string }
  | { type: 'window' | 'watching'; from: number; to: number; label: string }

type Lane = { ticker: string; status: Status; logoUrl?: string | null; bars: Bar[] }

const MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const FIRST_MONTH_IDX = 3 // Apr = index 3 in JS month numbering
const TODAY = 3.3 // index into months ≈ "now" (late Jul)

/* Parse a "May 27, 2026" / "2026-05-27" date into a fractional month-index
   aligned with MONTHS. Returns null when out of range or unparseable. */
function monthFraction(raw: string | null | undefined): number | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(+d)) return null
  const idx = d.getMonth() - FIRST_MONTH_IDX
  if (idx < 0 || idx > MONTHS.length - 1) return null
  return idx + (d.getDate() - 1) / 30
}

function laneFor(c: Company): Lane {
  const bars: Bar[] = []
  const reportedAt = monthFraction(c.latest?.reportedOn)
  if (reportedAt != null) {
    const flag = c.status === 'review' ? ' ⚑' : ''
    bars.push({ type: 'reported', at: reportedAt, label: `${c.latest.period} · ${c.latest.reportedOn}${flag}` })
  }
  const from = monthFraction(c.nextWindow?.from)
  const to = monthFraction(c.nextWindow?.to)
  if (from != null && to != null && to > from) {
    bars.push({
      type: c.status === 'watching' ? 'watching' : 'window',
      from,
      to,
      label: c.nextWindow.label || (c.status === 'watching' ? 'watching' : 'expected'),
    })
  }
  return { ticker: c.ticker, status: c.status, logoUrl: c.logoUrl, bars }
}

export function Timeline() {
  const navigate = useNavigate()
  const { data: companies } = useCompanies()
  const lanes = useMemo<Lane[]>(() => (companies ?? []).map(laneFor), [companies])
  const colW = 100 / MONTHS.length

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">FILING TIMELINE</h1>
          <p className="screen-sub">
            Predicted windows from each company's historical cadence. Agents start watching at the
            left edge of a window.
          </p>
        </div>
      </div>
      {lanes.length === 0 ? (
        <Panel>
          <div className="empty">
            No companies on the watchlist yet. Add some from the COMPANIES screen.
          </div>
        </Panel>
      ) : (
        <>
          <div className="tl-desktop">
            <Panel pad={false}>
              <div className="tl">
                <div className="tl-head">
                  <div className="tl-lanelabel" />
                  <div className="tl-track">
                    {MONTHS.map((m) => (
                      <div key={m} className="tl-month" style={{ width: colW + '%' }}>
                        {m} <span>’26</span>
                      </div>
                    ))}
                    <div className="tl-now" style={{ left: (TODAY + 0.5) * colW + '%' }}>
                      <span>NOW</span>
                    </div>
                  </div>
                </div>
                {lanes.map((ln) => (
                  <div className="tl-lane" key={ln.ticker} onClick={() => navigate('/company/' + ln.ticker)}>
                    <div className="tl-lanelabel">
                      <Glyph ticker={ln.ticker} status={ln.status} logoUrl={ln.logoUrl} />
                      <span>{ln.ticker}</span>
                    </div>
                    <div className="tl-track">
                      <div className="tl-now-line" style={{ left: (TODAY + 0.5) * colW + '%' }} />
                      {ln.bars.map((b, i) =>
                        b.type === 'reported' ? (
                          <div
                            key={i}
                            className="tl-marker"
                            style={{ left: (b.at + 0.5) * colW + '%' }}
                            title={b.label}
                          >
                            <span className="tl-dot" />
                            <span className="tl-mlabel">{b.label}</span>
                          </div>
                        ) : (
                          <div
                            key={i}
                            className={'tl-bar ' + (b.type === 'watching' ? 'watching' : 'window')}
                            style={{
                              left: (b.from + 0.5) * colW + '%',
                              width: (b.to - b.from) * colW + '%',
                            }}
                            title={b.label}
                          >
                            <span className="tl-blabel">{b.label}</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="tl-legend">
                <span>
                  <i className="lg lg-reported" /> reported & recorded
                </span>
                <span>
                  <i className="lg lg-window" /> predicted window
                </span>
                <span>
                  <i className="lg lg-watching" /> watching now
                </span>
              </div>
            </Panel>
          </div>

          {/* mobile: vertical agenda — same data, reorganised for narrow screens */}
          <div className="tl-mobile">
            {lanes.map((ln) => (
              <div className="tla-card" key={ln.ticker} onClick={() => navigate('/company/' + ln.ticker)}>
                <div className="tla-hd">
                  <Glyph ticker={ln.ticker} status={ln.status} logoUrl={ln.logoUrl} />
                  <span className="tla-ticker">{ln.ticker}</span>
                  <StatusChip status={ln.status} pulse />
                </div>
                <div className="tla-events">
                  {ln.bars.length === 0 ? (
                    <div className="tla-ev tla-empty">
                      <span className="tla-ev-type">NO SCHEDULE YET</span>
                      <span className="tla-ev-label">
                        Cadence will be predicted once a filing is recorded.
                      </span>
                    </div>
                  ) : (
                    ln.bars.map((b, i) => (
                      <div className={'tla-ev tla-' + b.type} key={i}>
                        <span className="tla-ev-icon" />
                        <span className="tla-ev-type">
                          {b.type === 'reported' ? 'REPORTED' : b.type === 'watching' ? 'WATCHING' : 'PREDICTED'}
                        </span>
                        <span className="tla-ev-label">{b.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
            <p className="tla-foot">
              Reported events recorded · predicted windows from each company's historical cadence.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
