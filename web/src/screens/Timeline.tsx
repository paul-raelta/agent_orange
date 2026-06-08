/* Agent Orange — Filing Timeline (timeline, §5.3). Predicted filing windows +
   live watching state across a months-across track. */
import { useNavigate } from 'react-router-dom'
import { Glyph, Panel } from '../components/primitives'
import type { Status } from '../components/status'

type Bar =
  | { type: 'reported'; at: number; label: string }
  | { type: 'window' | 'watching'; from: number; to: number; label: string }

type Lane = { ticker: string; status: Status; bars: Bar[] }

const MONTHS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const TODAY = 3.3 // index into months ≈ "now" (late Jul)

const LANES: Lane[] = [
  {
    ticker: 'NVDA',
    status: 'validated',
    bars: [
      { type: 'reported', at: 1.0, label: 'Q1 FY26 · May 27' },
      { type: 'window', from: 4.2, to: 4.9, label: 'Q2 FY26 expected' },
    ],
  },
  {
    ticker: 'SNDK',
    status: 'review',
    bars: [
      { type: 'reported', at: 3.4, label: 'Q4 · Jul 30 ⚑' },
      { type: 'window', from: 6.5, to: 7.1, label: 'Q1 expected' },
    ],
  },
  {
    ticker: 'MU',
    status: 'watching',
    bars: [
      { type: 'reported', at: 1.5, label: 'Q3 FY26 · Jun 25' },
      { type: 'watching', from: 4.9, to: 5.6, label: 'Q4 — watching' },
    ],
  },
]

export function Timeline() {
  const navigate = useNavigate()
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
          {LANES.map((ln) => (
            <div className="tl-lane" key={ln.ticker} onClick={() => navigate('/company/' + ln.ticker)}>
              <div className="tl-lanelabel">
                <Glyph ticker={ln.ticker} status={ln.status} />
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
  )
}
