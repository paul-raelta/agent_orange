/* Agent Orange — Round A feature mocks. Three explorations on the real visual
   system: (1) Consensus vs Actual, (2) Conflict-Resolution workspace,
   (3) Guidance tab. Presentational only — wired with sample data for review. */
const { useState } = React

/* ---------- shared primitives ---------- */
function Glyph({ t, g, sm }) {
  return <span className={'mk-glyph' + (sm ? ' sm' : '')} style={{ ['--g']: g || 'var(--text-3)' }}>{t.slice(0, 2)}</span>
}
function Conf({ level }) {
  const map = { high: ['HIGH', 'var(--green)'], med: ['MED', 'var(--amber)'], low: ['LOW', 'var(--red)'] }
  const [lbl, c] = map[level]
  return <span className="mk-conf" style={{ color: c, borderColor: c }}>{lbl}</span>
}
function BeatBadge({ pct }) {
  const beat = pct > 0.3, miss = pct < -0.3
  const c = beat ? 'var(--green)' : miss ? 'var(--red)' : 'var(--text-2)'
  const lbl = beat ? 'BEAT' : miss ? 'MISS' : 'IN LINE'
  return (
    <span className="mk-beat" style={{ color: c, borderColor: c, background: beat ? 'rgba(78,199,122,.1)' : miss ? 'rgba(255,107,94,.1)' : 'transparent' }}>
      {lbl} {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

/* ===================================================================
   1 · CONSENSUS vs ACTUAL
   =================================================================== */
function ConsensusCard() {
  return (
    <div className="mk-card" style={{ ['--g']: 'var(--green)' }}>
      <div className="mk-c-top">
        <Glyph t="NVDA" g="var(--green)" />
        <div className="mk-c-id">
          <div className="mk-tkr">NVDA</div>
          <div className="mk-sub">Nvidia · Q1 FY26</div>
        </div>
        <BeatBadge pct={5.7} />
      </div>
      <div className="mk-c-price">
        <span className="mk-pv">$124.92</span>
        <span className="delta-up mk-chg">▲ 8.1% AH</span>
      </div>
      <div className="mk-cons">
        {[
          ['REVENUE', '$44.06B', '$43.3B', 1.8],
          ['EPS · DIL', '$2.39', '$2.29', 4.4],
          ['GROSS MGN', '78.4%', '78.0%', 0.5],
        ].map(([k, act, est, surp]) => (
          <div className="mk-cons-row" key={k}>
            <span className="mk-cons-k">{k}</span>
            <span className="mk-cons-act">{act}</span>
            <span className="mk-cons-est">est {est}</span>
            <span className="mk-cons-surp delta-up">+{surp}%</span>
          </div>
        ))}
      </div>
      <div className="mk-c-foot">
        <span className="mk-src">▲ Surprise vs Street · 28 estimates</span>
      </div>
    </div>
  )
}
function ConsensusTable() {
  return (
    <div>
      <div className="mk-h2">Deep-dive · beat/miss banner</div>
      <div className="mk-banner">
        <BeatBadge pct={4.4} />
        <span className="mk-banner-tx"><b>EPS $2.39</b> vs $2.29 consensus — beat by $0.10. Revenue beat 1.8%; all 5 metrics above estimate.</span>
      </div>
      <div className="mk-h2" style={{ marginTop: 18 }}>Results table · "vs est" column</div>
      <div className="mk-tbl">
        <div className="mk-tr mk-thead">
          <span>METRIC</span><span className="num">ACTUAL</span><span className="num">CONSENSUS</span><span className="num">SURPRISE</span><span className="num">CONF</span>
        </div>
        {[
          ['Revenue', '$44.06B', '$43.30B', '+1.8%', 'high'],
          ['EPS diluted', '$2.39', '$2.29', '+4.4%', 'high'],
          ['Net income', '$18.8B', '$17.9B', '+5.0%', 'high'],
          ['Gross margin', '78.4%', '78.0%', '+0.4pp', 'med'],
        ].map(([m, a, c, s, cf]) => (
          <div className="mk-tr" key={m}>
            <span>{m}</span><span className="num">{a}</span><span className="num mk-est">{c}</span>
            <span className="num delta-up">{s}</span><span className="num"><Conf level={cf} /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===================================================================
   2 · CONFLICT-RESOLUTION WORKSPACE
   =================================================================== */
function ConflictWorkspace() {
  const [choice, setChoice] = useState(null)
  const sources = [
    { id: 'A', kind: 'SEC', label: 'Form 10-Q · p.5', url: 'sec.gov/…/amd-10q.htm', val: '$0.96', conf: 'high',
      snip: 'Diluted earnings per share … <b>$0.96</b>', note: 'Linked from EDGAR · audited' },
    { id: 'B', kind: 'IR', label: 'Press release · p.1', url: 'ir.amd.com/…/q2-25', val: '$1.00', conf: 'med',
      snip: 'Non-GAAP diluted EPS of <b>$1.00</b>', note: 'Newsroom · non-GAAP basis' },
  ]
  return (
    <div className="mk-cw">
      <div className="mk-cw-hd">
        <Glyph t="AMD" g="var(--blue)" sm />
        <div>
          <div className="mk-tkr" style={{ fontSize: 14 }}>AMD · EPS diluted</div>
          <div className="mk-sub">Conflict — 2 sources disagree · Q2 2025</div>
        </div>
        <span className="mk-flag">⚑ NEEDS DECISION</span>
      </div>

      <div className="mk-diff">
        {sources.map((s) => (
          <div className={'mk-col' + (choice === s.id ? ' pick' : '')} key={s.id}>
            <div className="mk-col-hd">
              <span className="mk-srcpill"><b>{s.kind}</b> {s.label}</span>
              <Conf level={s.conf} />
            </div>
            <div className="mk-val">{s.val}</div>
            <div className="mk-snip" dangerouslySetInnerHTML={{ __html: '“' + s.snip + '”' }} />
            <a className="mk-link">{s.url} ↗</a>
            <div className="mk-note">{s.note}</div>
            <button className={'mk-pick' + (choice === s.id ? ' on' : '')} onClick={() => setChoice(s.id)}>
              {choice === s.id ? '✓ ACCEPTED' : 'Accept ' + s.id}
            </button>
          </div>
        ))}
        <div className="mk-vs">VS</div>
      </div>

      <div className="mk-rail">
        <div className="mk-rail-actions">
          <button className="mk-act ghost" onClick={() => setChoice('flag')}>⚑ Flag for analyst</button>
          <button className="mk-act ghost" onClick={() => setChoice('both')}>✕ Both wrong</button>
        </div>
        <input className="mk-noteinput" placeholder="Decision note (required)…" defaultValue="GAAP basis is the comparable figure for our model." />
        <button className="mk-act prim" disabled={!choice}>Resolve & continue →</button>
      </div>

      <div className="mk-history">
        <span className="lbl2">SIMILAR PAST RESOLUTIONS</span>
        <div className="mk-hist-row">GAAP vs non-GAAP EPS · resolved <b>Accept SEC</b> · 7× this quarter</div>
      </div>
    </div>
  )
}

/* ===================================================================
   3 · GUIDANCE TAB
   =================================================================== */
function GuidanceTab() {
  const rows = [
    { metric: 'Revenue', period: 'Q3 FY26', low: '16.0', high: '16.4', unit: 'B', prior: '15.2–15.6B', dir: 'raised' },
    { metric: 'Gross margin', period: 'Q3 FY26', low: '78.0', high: '79.0', unit: '%', prior: '77.5–78.5%', dir: 'raised' },
    { metric: 'Opex', period: 'Q3 FY26', low: '4.0', high: '4.1', unit: 'B', prior: '4.0–4.1B', dir: 'maintained' },
  ]
  const dirMap = { raised: ['RAISED ▲', 'var(--green)'], cut: ['CUT ▼', 'var(--red)'], maintained: ['MAINTAINED', 'var(--text-2)'] }
  return (
    <div>
      <div className="mk-tabs">
        {['RESULTS', 'VALIDATION', 'GUIDANCE', 'NEWS'].map((t) => (
          <span key={t} className={'mk-tab' + (t === 'GUIDANCE' ? ' on' : '')}>{t}</span>
        ))}
      </div>
      <div className="mk-g-intro">Forward outlook extracted from management commentary, tracked vs. prior guidance.</div>
      {rows.map((r) => {
        const [lbl, c] = dirMap[r.dir]
        return (
          <div className="mk-g-row" key={r.metric}>
            <div className="mk-g-top">
              <span className="mk-g-metric">{r.metric}</span>
              <span className="mk-g-period">{r.period}</span>
              <span className="mk-g-dir" style={{ color: c, borderColor: c }}>{lbl}</span>
            </div>
            <div className="mk-g-range">
              <span className="mk-g-now">${r.low}–{r.high}{r.unit !== 'B' ? r.unit : 'B'}</span>
              <span className="mk-g-prior">was {r.prior}</span>
            </div>
            <div className="mk-g-bar">
              <div className="mk-g-bar-prior" />
              <div className="mk-g-bar-now" style={{ borderColor: c }} />
            </div>
            <div className="mk-g-prov">▸ "We expect Q3 revenue of ${r.low} billion to ${r.high} billion…" · Earnings call · p.3</div>
          </div>
        )
      })}
    </div>
  )
}

Object.assign(window, { ConsensusCard, ConsensusTable, ConflictWorkspace, GuidanceTab })
