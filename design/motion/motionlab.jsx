/* Agent Orange — Motion Lab. Toggle each animation on real cards, tune speed +
   stagger, and replay. Effects are CSS classes on the .lab root; durations scale
   with --sp. Pick what feels right; I'll fold the winners into the prototype. */
const { useState, useEffect, useRef, useLayoutEffect } = React

const STATUS = {
  validated: { g: 'var(--green)', label: 'VALIDATED', dot: 'var(--green)' },
  review: { g: 'var(--blue)', label: 'NEEDS REVIEW', dot: 'var(--blue)' },
  watching: { g: 'var(--amber)', label: 'WATCHING', dot: 'var(--amber)' },
}

const WATCH = [
  { t: 'NVDA', n: 'Nvidia', s: 'validated', p: 124.92, c: 1.86, spark: [1.1, 1.3, 1.6, 1.9, 2.1, 2.39],
    m: [['REVENUE', '$44.06B', '+69%'], ['EPS · DIL', '$2.39', '+71%'], ['NET INC', '$18.8B', '+82%']] },
  { t: 'MSFT', n: 'Microsoft', s: 'validated', p: 440.37, c: -0.51, spark: [2.7, 2.9, 2.95, 3.0, 3.05, 3.23],
    m: [['REVENUE', '$70.1B', '+18%'], ['EPS · DIL', '$3.23', '+20%'], ['NET INC', '$24.1B', '+18%']] },
  { t: 'AAPL', n: 'Apple', s: 'watching', p: 214.92, c: 2.76, spark: [1.4, 1.5, 1.3, 1.6, 1.5, 1.65],
    m: [['REVENUE', '$95.4B', '+5%'], ['EPS · DIL', '$1.65', '+8%'], ['NET INC', '$24.8B', '+5%']] },
  { t: 'AMD', n: 'Advanced Micro Devices', s: 'review', p: 159.61, c: -1.2, spark: [0.6, 0.7, 0.9, 0.8, 1.0, 0.96],
    m: [['REVENUE', '$7.44B', '+36%'], ['EPS · DIL', '$0.96', '+55%'], ['NET INC', '$1.57B', '+76%']] },
  { t: 'AVGO', n: 'Broadcom', s: 'validated', p: 174.58, c: 2.14, spark: [1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
    m: [['REVENUE', '$15.0B', '+20%'], ['EPS · DIL', '$1.60', '+24%'], ['NET INC', '$4.9B', '+22%']] },
  { t: 'ORCL', n: 'Oracle', s: 'watching', p: 139.78, c: 0.42, spark: [1.3, 1.4, 1.45, 1.5, 1.52, 1.54],
    m: [['REVENUE', '$14.1B', '+9%'], ['EPS · DIL', '$1.54', '+11%'], ['NET INC', '$3.5B', '+10%']] },
]

const ADD = {
  'Information Technology': [
    ['ORCL', 'Oracle', 139.78], ['CRM', 'Salesforce', 250.1], ['ADBE', 'Adobe', 480.4],
    ['QCOM', 'Qualcomm', 170.2], ['TXN', 'Texas Instruments', 195.6], ['INTU', 'Intuit', 640.0],
  ],
  'Health Care': [
    ['LLY', 'Eli Lilly', 800.2], ['UNH', 'UnitedHealth', 500.4], ['ABBV', 'AbbVie', 175.1],
    ['TMO', 'Thermo Fisher', 560.0], ['ISRG', 'Intuitive Surgical', 450.3], ['VRTX', 'Vertex Pharma', 470.9],
  ],
}

function sparkPath(data, w = 200, h = 30) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const step = w / (data.length - 1)
  return data.map((v, i) => (i ? 'L' : 'M') + (i * step).toFixed(1) + ' ' + (h - ((v - min) / span) * (h - 4) - 2).toFixed(1)).join(' ')
}

function CountUp({ value, decimals = 0, prefix = '', suffix = '', run, gen }) {
  const [val, setVal] = useState(run ? 0 : value)
  useEffect(() => {
    if (!run) { setVal(value); return }
    let raf, start
    const dur = 800
    const tick = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      setVal(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, gen, value])
  return <span>{prefix}{val.toFixed(decimals)}{suffix}</span>
}

function Spark({ data }) {
  return (
    <svg className="spark" width="100%" height="30" viewBox="0 0 200 30" preserveAspectRatio="none">
      <path className="spark-path" pathLength="1" d={sparkPath(data)} />
    </svg>
  )
}

function WCard({ d, i, delay, tickKey, pre }) {
  const st = STATUS[d.s]
  const [px, setPx] = useState(d.p)
  const [dir, setDir] = useState('')
  useEffect(() => {
    if (tickKey === 0) return
    const delta = (Math.random() * 4 - 2)
    setDir(delta >= 0 ? 'up' : 'down')
    setPx((p) => +(p + delta).toFixed(2))
    const t = setTimeout(() => setDir(''), 900)
    return () => clearTimeout(t)
  }, [tickKey])
  return (
    <article className={'wcard anim' + (pre ? ' pre' : '')} style={{ ['--g']: st.g, transitionDelay: delay, ['--i']: i }}>
      <div className="wc-top">
        <span className="glyph" style={{ ['--g']: st.g }}>{d.t.slice(0, 2)}</span>
        <div className="wc-id">
          <div className="wc-tkr">{d.t}</div>
          <div className="wc-name">{d.n}</div>
        </div>
        <span className="chip"><span className={'dot' + (d.s === 'watching' ? ' pulse' : '')} style={{ background: st.dot }} />{st.label}</span>
      </div>
      <div className="wc-price">
        <span className={'wc-pv ' + dir}>${px.toFixed(2)}</span>
        <span className={'wc-chg ' + (d.c >= 0 ? 'delta-up' : 'delta-down')}>{d.c >= 0 ? '▲' : '▼'} {Math.abs(d.c).toFixed(2)}%</span>
      </div>
      <Spark data={d.spark} />
      <div className="wc-metrics">
        {d.m.map(([k, v, dd]) => (
          <div className="wc-m" key={k}>
            <div className="k">{k}</div>
            <div className="v">{v}</div>
            <div className={'d ' + (dd.startsWith('-') ? 'delta-down' : 'delta-up')}>{dd.startsWith('-') ? '▼' : '▲'} {dd.replace('-', '')}</div>
          </div>
        ))}
      </div>
    </article>
  )
}

function Skel({ delay }) {
  return (
    <div className="skel" style={{ animationDelay: delay }}>
      <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
        <div className="b" style={{ width: 34, height: 34 }} />
        <div style={{ flex: 1 }}>
          <div className="b" style={{ width: '50%', height: 12, marginBottom: 6 }} />
          <div className="b" style={{ width: '70%', height: 8 }} />
        </div>
      </div>
      <div className="b" style={{ width: '40%', height: 14, marginBottom: 12 }} />
      <div className="b" style={{ width: '100%', height: 26, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((j) => <div key={j} className="b" style={{ flex: 1, height: 34 }} />)}
      </div>
    </div>
  )
}

function ACard({ d, sel, onToggle, i }) {
  return (
    <div className={'acard' + (sel ? ' sel' : '')} style={{ ['--i']: i }} onClick={onToggle}>
      <div className="ac-top">
        <span className="glyph sm">{d[0].slice(0, 2)}</span>
        <div className="ac-id">
          <div className="ac-tkr">{d[0]}</div>
          <div className="ac-nm">{d[1]}</div>
        </div>
        <span className="check"><svg viewBox="0 0 12 12"><path pathLength="1" d="M2.5 6.2 L5 8.6 L9.5 3.6" /></svg></span>
      </div>
      <div className="ac-px">$<b>{d[2].toFixed(2)}</b></div>
    </div>
  )
}

const TABS = ['RESULTS', 'VALIDATION', 'NEWS', 'AGENT RUNS']

function Tabs() {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  const [ink, setInk] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = refs.current[active]
    if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])
  return (
    <div className="tabs">
      {TABS.map((t, i) => (
        <button key={t} ref={(e) => (refs.current[i] = e)} className={active === i ? 'on' : ''} onClick={() => setActive(i)}>{t}</button>
      ))}
      <span className="ink" style={{ transform: `translateX(${ink.left}px)`, width: ink.width }} />
    </div>
  )
}

const FX_GROUPS = [
  ['Entrance', [['stagger', 'Staggered card rise'], ['spark', 'Sparkline trace']]],
  ['Loading', [['shimmer', 'Skeleton shimmer'], ['cross', 'Crossfade in']]],
  ['Selection', [['snap', 'Select snap'], ['checkdraw', 'Check draw'], ['roll', 'Tray count roll'], ['ripple', 'Sector select ripple']]],
  ['Data', [['tick', 'Price tick flash'], ['countup', 'Count-up stats']]],
  ['Micro', [['glow', 'Card hover glow'], ['tabslide', 'Tab underline slide'], ['drawerfade', 'Drawer content fade']]],
]

const DEFAULT_FX = { stagger: true, spark: true, shimmer: true, cross: true, snap: true, checkdraw: true, roll: true, ripple: true, tick: true, countup: true, glow: true, tabslide: true, drawerfade: true }

function Lab() {
  const [fx, setFx] = useState(DEFAULT_FX)
  const [speed, setSpeed] = useState(1)
  const [stagger, setStagger] = useState(40)
  const [gen, setGen] = useState(1)
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    setEntering(true)
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setEntering(false)))
    const t = setTimeout(() => setEntering(false), 90)
    return () => { cancelAnimationFrame(r); clearTimeout(t) }
  }, [gen])
  const [loading, setLoading] = useState(false)
  const [tickKey, setTickKey] = useState(0)
  const [sel, setSel] = useState(new Set())
  const [rippling, setRippling] = useState({})
  const [drawer, setDrawer] = useState(false)
  const [rmPreview, setRmPreview] = useState(false)

  useEffect(() => { document.documentElement.style.setProperty('--sp', String(1 / speed)) }, [speed])

  const cls = 'lab ' + Object.entries(fx).filter(([, v]) => v).map(([k]) => 'fx-' + k).join(' ') + (rmPreview ? ' rm-preview' : '')
  const dly = (i) => (fx.stagger || fx.cross ? `${(i * stagger) / speed}ms` : '0ms')

  const replay = () => setGen((g) => g + 1)
  const simulateLoading = () => { setLoading(true); setTimeout(() => { setLoading(false); setGen((g) => g + 1) }, 1500) }
  const toggle = (k) => setFx((f) => ({ ...f, [k]: !f[k] }))
  const toggleSel = (t) => setSel((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n })
  const selectAll = (sector) => {
    const all = ADD[sector].map((d) => d[0])
    setSel((s) => { const n = new Set(s); all.forEach((t) => n.add(t)); return n })
    setRippling((r) => ({ ...r, [sector]: true }))
    setTimeout(() => setRippling((r) => ({ ...r, [sector]: false })), 700)
  }

  return (
    <div className={cls}>
      <div className="wrap">
        <div className="content" key={gen}>
          <div className="sec-title">WATCHLIST</div>
          <div className="sec-sub">Entrance · loading · price ticks · count-up — the home screen on load.</div>

          <div className={'pf anim' + (entering ? ' pre' : '')} style={{ transitionDelay: dly(0) }}>
            <div><span className="lbl">PORTFOLIO</span><div className="v"><CountUp value={284932} prefix="$" run={fx.countup} gen={gen} /></div></div>
            <div><span className="lbl">UNREALIZED</span><div className="v delta-up">▲ <CountUp value={64231} prefix="$" run={fx.countup} gen={gen} /> <span style={{ fontSize: 11 }}>+29.1%</span></div></div>
            <div><span className="lbl">AGENTS</span><div className="v"><CountUp value={6} run={fx.countup} gen={gen} /></div></div>
          </div>

          {loading ? (
            <div className="wl-grid">{WATCH.map((_, i) => <Skel key={i} delay={dly(i)} />)}</div>
          ) : (
            <div className="wl-grid">{WATCH.map((d, i) => <WCard key={d.t} d={d} i={i} delay={dly(i)} tickKey={tickKey} pre={entering} />)}</div>
          )}

          <div className="sec-title">DEEP-DIVE TABS</div>
          <div className="sec-sub">Tab underline slide + provenance drawer fade.</div>
          <Tabs />
          <button className="act" style={{ width: 'auto', display: 'inline-block' }} onClick={() => setDrawer(true)}>Open provenance drawer →</button>

          <div className="sec-title">ADD COMPANIES</div>
          <div className="sec-sub">Select snap · check draw · select-all ripple · tray count roll.</div>
          {Object.entries(ADD).map(([sector, list]) => (
            <div className={'agroup' + (rippling[sector] ? ' rippling' : '')} key={sector}>
              <div className="agroup-hd">
                <span className="gname">{sector}</span>
                <span className="gc">{list.length} cos</span>
                <button className="selall" onClick={() => selectAll(sector)}>Select all</button>
              </div>
              <div className="agrid">
                {list.map((d, i) => <ACard key={d[0]} d={d} i={i} sel={sel.has(d[0])} onToggle={() => toggleSel(d[0])} />)}
              </div>
            </div>
          ))}
          {sel.size > 0 && (
            <div className="tray">
              <span className="cnt"><span className="roll" key={sel.size}>{sel.size}</span> selected</span>
              <button className="tbtn">ADD {sel.size} →</button>
            </div>
          )}
        </div>

        {/* control rail */}
        <div className="rail">
          <div className="rail-hd">
            <div className="t">MOTION LAB</div>
            <div className="s">Toggle effects · tune speed · replay</div>
          </div>

          <div className="slider rgroup">
            <div className="sl-top"><span>Speed</span><b>{speed.toFixed(2)}×</b></div>
            <input type="range" min="0.3" max="2" step="0.05" value={speed} onChange={(e) => setSpeed(+e.target.value)} />
            <div className="sl-top" style={{ marginTop: 12 }}><span>Stagger / card</span><b>{stagger}ms</b></div>
            <input type="range" min="0" max="120" step="5" value={stagger} onChange={(e) => setStagger(+e.target.value)} />
          </div>

          {FX_GROUPS.map(([group, items]) => (
            <div className="rgroup" key={group}>
              <div className="gt">{group}</div>
              {items.map(([k, label]) => (
                <div className="row" key={k} onClick={() => toggle(k)}>
                  <label>{label}</label>
                  <span className={'sw' + (fx[k] ? ' on' : '')} />
                </div>
              ))}
            </div>
          ))}

          <div className="acts">
            <button className="act prim" onClick={replay}>▶ Replay entrance</button>
            <button className="act" onClick={simulateLoading}>⟳ Simulate loading</button>
            <button className="act" onClick={() => setTickKey((k) => k + 1)}>$ Simulate price tick</button>
            <button className="act" onClick={() => setSel(new Set())}>Clear selection</button>
            <div className="row" style={{ marginTop: 4 }} onClick={() => setRmPreview((v) => !v)}>
              <label>Preview reduced-motion</label>
              <span className={'sw' + (rmPreview ? ' on' : '')} />
            </div>
          </div>
          <div className="note">All effects are CSS-driven and gated on <code>prefers-reduced-motion</code>. Durations scale with Speed. Pick the set you like and I'll wire them into the prototype + the Claude Code handoff.</div>
        </div>
      </div>

      <div className={'scrim' + (drawer ? ' open' : '')} onClick={() => setDrawer(false)} />
      <div className={'drawer' + (drawer ? ' open' : '')}>
        <h3 className="fadein" style={{ animationDelay: '0ms' }}>PROVENANCE · EPS · DILUTED</h3>
        <div className="fadein" style={{ animationDelay: '60ms', fontSize: 26, fontWeight: 700, marginBottom: 14 }}>$2.39 <span style={{ fontSize: 11, color: 'var(--green)' }}>HIGH</span></div>
        {[['Form 10-Q · p.5', 'sec.gov/…/nvda-10q.htm', 'Diluted earnings per share … $2.39'],
          ['Press release · p.1', 'nvidianews.com/…/q1-fy26', 'GAAP earnings per diluted share of $2.39, up 71%'],
          ['Note 3 · p.9', 'sec.gov/…/nvda-10q.htm#n3', 'Net income per share — diluted … 2.39']].map((p, i) => (
          <div className="prov fadein" key={i} style={{ animationDelay: `${120 + i * 70}ms` }}>
            <div className="s">{p[0]}</div>
            <div className="u">{p[1]}</div>
            <div className="q">“{p[2]}”</div>
          </div>
        ))}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Lab />)
