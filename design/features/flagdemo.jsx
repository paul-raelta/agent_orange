/* Agent Orange — Feature-Flag demo. Three compartmentalized features gated by
   Settings toggles. The point: each feature is `flag && <Feature/>` over OPTIONAL
   data — flip it off and the surface vanishes with zero impact on anything else.
   Persisted to localStorage 'ao-feature-flags-demo'. */
const { useState, useEffect } = React

const FLAG_DEFS = [
  { key: 'consensus', name: 'Consensus vs Actual', desc: 'Surprise chips, beat/miss banner, and a “vs estimate” column.', surfaces: 'Watchlist card · Deep-dive header + Results table' },
  { key: 'conflict', name: 'Conflict-Resolution Workspace', desc: 'Side-by-side source diff with a decision rail for disputed figures.', surfaces: 'Review queue item' },
  { key: 'guidance', name: 'Guidance Tracking', desc: 'Forward outlook vs prior guidance, with provenance.', surfaces: 'Deep-dive · GUIDANCE tab' },
]
const DEFAULTS = { consensus: true, conflict: true, guidance: true }

function useFlags() {
  const [flags, setFlags] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ao-feature-flags-demo') || '{}') } }
    catch { return DEFAULTS }
  })
  useEffect(() => { localStorage.setItem('ao-feature-flags-demo', JSON.stringify(flags)) }, [flags])
  return [flags, (k) => setFlags((f) => ({ ...f, [k]: !f[k] }))]
}

function Glyph({ t, g, sm }) {
  return <span className={'fd-glyph' + (sm ? ' sm' : '')} style={{ ['--g']: g }}>{t.slice(0, 2)}</span>
}
function Conf({ level }) {
  const m = { high: ['HIGH', 'var(--green)'], med: ['MED', 'var(--amber)'] }
  const [l, c] = m[level]
  return <span className="fd-conf" style={{ color: c, borderColor: c }}>{l}</span>
}

/* ---- Watchlist card: consensus adds surprise chips ONLY ---- */
function WatchCard({ flags }) {
  const metrics = [
    ['REVENUE', '$44.06B', '+1.8%'],
    ['EPS · DIL', '$2.39', '+4.4%'],
    ['NET INC', '$18.8B', '+5.0%'],
  ]
  return (
    <div className="fd-card" style={{ ['--g']: 'var(--green)' }}>
      <div className="fd-card-top">
        <Glyph t="NVDA" g="var(--green)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fd-tkr">NVDA</div>
          <div className="fd-name">Nvidia · Q1 FY26</div>
        </div>
        {flags.consensus
          ? <span className="fd-beat">BEAT +5.7%</span>
          : <span className="fd-chip" style={{ color: 'var(--green)', borderColor: 'rgba(78,199,122,.4)' }}><span className="fd-dot" style={{ background: 'var(--green)' }} />VALIDATED</span>}
      </div>
      <div className="fd-price">
        <span className="fd-pv">$124.92</span>
        <span className="delta-up" style={{ fontSize: 11 }}>▲ 1.86%</span>
      </div>
      <div className="fd-metrics">
        {metrics.map(([k, v, s]) => (
          <div className="fd-m" key={k}>
            <div className="fd-mk">{k}</div>
            <div className="fd-mv">{v}</div>
            {flags.consensus
              ? <div className="fd-ms delta-up">{s} vs est</div>
              : <div className="fd-md delta-up">▲ YoY</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Deep-dive: guidance adds a TAB; consensus adds banner + column ---- */
function DeepDive({ flags }) {
  const baseTabs = ['RESULTS', 'VALIDATION', 'NEWS', 'AGENT RUNS']
  const tabs = flags.guidance ? ['RESULTS', 'VALIDATION', 'GUIDANCE', 'NEWS', 'AGENT RUNS'] : baseTabs
  const [tab, setTab] = useState('RESULTS')
  useEffect(() => { if (!tabs.includes(tab)) setTab('RESULTS') }, [flags.guidance])

  return (
    <div className="fd-dd">
      <div className="fd-dd-hd">
        <Glyph t="NVDA" g="var(--green)" sm />
        <div style={{ flex: 1 }}>
          <div className="fd-tkr" style={{ fontSize: 14 }}>NVDA <span className="fd-name">· Semiconductors</span></div>
        </div>
        <span className="fd-pv" style={{ fontSize: 14 }}>$124.92</span>
      </div>

      {flags.consensus && (
        <div className="fd-banner">
          <span className="fd-beat">BEAT +4.4%</span>
          <span className="fd-banner-tx"><b>EPS $2.39</b> vs $2.29 consensus — all 5 metrics above estimate.</span>
        </div>
      )}

      <div className="fd-tabs">
        {tabs.map((t) => (
          <button key={t} className={'fd-tab' + (t === tab ? ' on' : '') + (t === 'GUIDANCE' ? ' fd-new' : '')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'RESULTS' && (
        <div className="fd-tbl">
          <div className={'fd-tr fd-thead' + (flags.consensus ? ' wide' : '')}>
            <span>METRIC</span><span className="num">ACTUAL</span>
            {flags.consensus && <span className="num">CONS</span>}
            {flags.consensus && <span className="num">SURP</span>}
            <span className="num">CONF</span>
          </div>
          {[['Revenue', '$44.06B', '$43.30B', '+1.8%', 'high'], ['EPS diluted', '$2.39', '$2.29', '+4.4%', 'high'], ['Net income', '$18.8B', '$17.9B', '+5.0%', 'med']].map(([m, a, c, s, cf]) => (
            <div className={'fd-tr' + (flags.consensus ? ' wide' : '')} key={m}>
              <span>{m}</span><span className="num">{a}</span>
              {flags.consensus && <span className="num fd-est">{c}</span>}
              {flags.consensus && <span className="num delta-up">{s}</span>}
              <span className="num"><Conf level={cf} /></span>
            </div>
          ))}
        </div>
      )}

      {tab === 'GUIDANCE' && (
        <div className="fd-guid">
          {[['Revenue', '$16.0–16.4B', 'was $15.2–15.6B', 'RAISED ▲', 'var(--green)'], ['Gross margin', '78.0–79.0%', 'was 77.5–78.5%', 'RAISED ▲', 'var(--green)']].map(([m, now, prior, dir, c]) => (
            <div className="fd-g-row" key={m}>
              <div className="fd-g-top"><span className="fd-g-metric">{m}</span><span className="fd-g-period">Q3 FY26</span><span className="fd-g-dir" style={{ color: c, borderColor: c }}>{dir}</span></div>
              <div className="fd-g-range"><span className="fd-g-now">{now}</span><span className="fd-g-prior">{prior}</span></div>
              <div className="fd-g-prov">▸ "We expect Q3 revenue of $16.0–16.4 billion…" · Earnings call · p.3</div>
            </div>
          ))}
        </div>
      )}

      {tab !== 'RESULTS' && tab !== 'GUIDANCE' && <div className="fd-placeholder">{tab} content…</div>}
    </div>
  )
}

/* ---- Review queue: conflict swaps the simple item for the rich workspace ---- */
function ReviewItem({ flags }) {
  const [choice, setChoice] = useState(null)
  return (
    <div className="fd-review">
      <div className="fd-rev-hd"><span className="lbl3">REVIEW QUEUE · 1 ITEM</span></div>
      {flags.conflict ? (
        <div className="fd-cw">
          <div className="fd-cw-hd">
            <Glyph t="AMD" g="var(--blue)" sm />
            <div><div className="fd-tkr" style={{ fontSize: 13 }}>AMD · EPS diluted</div><div className="fd-name">2 sources disagree · Q2 2025</div></div>
            <span className="fd-flag">⚑ NEEDS DECISION</span>
          </div>
          <div className="fd-diff">
            {[['A', 'SEC', 'Form 10-Q · p.5', '$0.96', 'high'], ['B', 'IR', 'Press release', '$1.00', 'med']].map(([id, kind, lab, val, cf]) => (
              <div className={'fd-col' + (choice === id ? ' pick' : '')} key={id} onClick={() => setChoice(id)}>
                <div className="fd-col-hd"><span className="fd-srcpill"><b>{kind}</b> {lab}</span><Conf level={cf} /></div>
                <div className="fd-val">{val}</div>
                <button className={'fd-pickbtn' + (choice === id ? ' on' : '')}>{choice === id ? '✓ ACCEPTED' : 'Accept ' + id}</button>
              </div>
            ))}
            <div className="fd-vs">VS</div>
          </div>
        </div>
      ) : (
        <div className="fd-simple">
          <div className="fd-simple-row">
            <Glyph t="AMD" g="var(--blue)" sm />
            <div style={{ flex: 1 }}><div className="fd-tkr" style={{ fontSize: 13 }}>AMD · EPS diluted</div><div className="fd-name">Needs review · $0.96</div></div>
            <button className="fd-mini">Confirm</button>
            <button className="fd-mini ghost">Flag</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Settings panel with the feature flags ---- */
function SettingsFlags({ flags, toggle }) {
  return (
    <div className="fd-settings">
      <div className="fd-set-hd">
        <span className="fd-gear">⚙</span>
        <div><div className="fd-set-t">SETTINGS · LABS</div><div className="fd-set-s">Feature flags — turn capabilities on or off</div></div>
      </div>
      {FLAG_DEFS.map((f) => (
        <div className="fd-flag-row" key={f.key}>
          <div className="fd-flag-info">
            <div className="fd-flag-name">{f.name}</div>
            <div className="fd-flag-desc">{f.desc}</div>
            <div className="fd-flag-surf">▸ {f.surfaces}</div>
          </div>
          <button className={'fd-sw' + (flags[f.key] ? ' on' : '')} onClick={() => toggle(f.key)} aria-label={'Toggle ' + f.name} />
        </div>
      ))}
      <div className="fd-set-note">Each feature renders only when its flag is on, over optional data. Off = the surface disappears; nothing else is touched. No restart, no migration.</div>
    </div>
  )
}

function App() {
  const [flags, toggle] = useFlags()
  const onCount = Object.values(flags).filter(Boolean).length
  return (
    <div className="fd-wrap">
      <div className="fd-main">
        <div className="fd-bar">
          <span className="fd-logo">◑ AGENT ORANGE</span>
          <span className="fd-bar-sub">Feature-flag demo · {onCount}/3 features on</span>
        </div>
        <div className="fd-stage">
          <div className="fd-col-left">
            <div className="fd-label">WATCHLIST</div>
            <WatchCard flags={flags} />
            <div className="fd-label" style={{ marginTop: 18 }}>REVIEW</div>
            <ReviewItem flags={flags} />
          </div>
          <div className="fd-col-right">
            <div className="fd-label">COMPANY · DEEP-DIVE</div>
            <DeepDive flags={flags} />
          </div>
        </div>
      </div>
      <div className="fd-rail">
        <SettingsFlags flags={flags} toggle={toggle} />
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
