/* Agent Orange — Timeline, Review Queue, Companies config, Activity, Settings. */
const { useState: useState2 } = React;

/* ===================== TIMELINE ===================== */
function Timeline({ data, onOpen }) {
  // months across (Apr 2026 → Dec 2026) for the demo
  const months = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const today = 3.3; // index into months ≈ "now" (late Jul)
  // bars: {ticker, type:'reported'|'window'|'watching', from, to}
  const lanes = [
    { ticker: "NVDA", status: "validated", bars: [ { type: "reported", at: 1.0, label: "Q1 FY26 · May 27" }, { type: "window", from: 4.2, to: 4.9, label: "Q2 FY26 expected" } ] },
    { ticker: "SNDK", status: "review", bars: [ { type: "reported", at: 3.4, label: "Q4 · Jul 30 ⚑" }, { type: "window", from: 6.5, to: 7.1, label: "Q1 expected" } ] },
    { ticker: "MU", status: "watching", bars: [ { type: "reported", at: 1.5, label: "Q3 FY26 · Jun 25" }, { type: "watching", from: 4.9, to: 5.6, label: "Q4 — watching" } ] },
  ];
  const colW = 100 / months.length;
  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">FILING TIMELINE</h1>
          <p className="screen-sub">Predicted windows from each company's historical cadence. Agents start watching at the left edge of a window.</p>
        </div>
      </div>
      <Panel pad={false}>
        <div className="tl">
          <div className="tl-head">
            <div className="tl-lanelabel" />
            <div className="tl-track">
              {months.map((m, i) => (<div key={m} className="tl-month" style={{ width: colW + "%" }}>{m} <span>’26</span></div>))}
              <div className="tl-now" style={{ left: (today + 0.5) * colW + "%" }}><span>NOW</span></div>
            </div>
          </div>
          {lanes.map((ln) => (
            <div className="tl-lane" key={ln.ticker} onClick={() => onOpen(ln.ticker)}>
              <div className="tl-lanelabel">
                <Glyph ticker={ln.ticker} status={ln.status} />
                <span>{ln.ticker}</span>
              </div>
              <div className="tl-track">
                <div className="tl-now-line" style={{ left: (today + 0.5) * colW + "%" }} />
                {ln.bars.map((b, i) =>
                  b.type === "reported" ? (
                    <div key={i} className="tl-marker" style={{ left: (b.at + 0.5) * colW + "%" }} title={b.label}>
                      <span className="tl-dot" /><span className="tl-mlabel">{b.label}</span>
                    </div>
                  ) : (
                    <div key={i} className={"tl-bar " + (b.type === "watching" ? "watching" : "window")}
                      style={{ left: (b.from + 0.5) * colW + "%", width: (b.to - b.from) * colW + "%" }} title={b.label}>
                      <span className="tl-blabel">{b.label}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="tl-legend">
          <span><i className="lg lg-reported" /> reported & recorded</span>
          <span><i className="lg lg-window" /> predicted window</span>
          <span><i className="lg lg-watching" /> watching now</span>
        </div>
      </Panel>
    </div>
  );
}

/* ===================== REVIEW QUEUE ===================== */
function Review({ data, onOpen }) {
  const [items, setItems] = useState2(data.reviewQueue);
  const [resolved, setResolved] = useState2({});
  function resolve(id, choice) { setResolved((r) => ({ ...r, [id]: choice })); }
  const pending = items.filter((i) => !resolved[i.id]);

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">REVIEW QUEUE</h1>
          <p className="screen-sub">{pending.length} finding{pending.length === 1 ? "" : "s"} need a human decision before they're recorded.</p>
        </div>
      </div>

      {items.length === 0 && <Panel><div className="empty">Nothing to review. Agents will queue items here when a number can't be auto-validated.</div></Panel>}

      <div className="rv-list">
        {items.map((it) => {
          const done = resolved[it.id];
          return (
            <article key={it.id} className={"rv-card" + (done ? " resolved" : "")}>
              <div className="rv-hd">
                <span className="rv-ticker" onClick={() => onOpen(it.ticker)}>{it.ticker}</span>
                <span className="rv-period">{it.period} · ended {it.periodEnd}</span>
                <Conf level={it.conf} />
                <span className="rv-found">found {it.foundOn}</span>
              </div>
              <div className="rv-reason"><b>{it.field}</b> — {it.reason}</div>

              <div className="rv-candidates">
                {it.candidates.map((cd, i) => (
                  <label key={i} className={"rv-cand" + (done === cd.value ? " chosen" : "")}>
                    <span className="rv-cand-val">{cd.value}</span>
                    <span className="rv-cand-src">{cd.source}</span>
                    <span className="rv-cand-weight">{cd.weight}</span>
                  </label>
                ))}
              </div>

              <ProvenanceItem p={it.snippet} />

              {done ? (
                <div className="rv-done">✓ Recorded <b>{done === "reject" ? "— rejected" : done}</b> · removed from queue</div>
              ) : (
                <div className="rv-actions">
                  {it.candidates.map((cd, i) => (
                    <Btn key={i} kind={i === 0 ? "primary" : "ghost"} sm onClick={() => resolve(it.id, cd.value)}>
                      USE {cd.value}
                    </Btn>
                  ))}
                  <Btn kind="danger" sm onClick={() => resolve(it.id, "reject")}>REJECT</Btn>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== COMPANIES (config) ===================== */
function Companies({ data, onOpen }) {
  const [adding, setAdding] = useState2(false);
  const [advanced, setAdvanced] = useState2(false);
  const [ticker, setTicker] = useState2("");
  const [phase, setPhase] = useState2("idle"); // idle | discovering | found
  const [discovered, setDiscovered] = useState2(null);

  function startDiscovery() {
    if (!ticker.trim()) return;
    setPhase("discovering");
    setTimeout(() => {
      setDiscovered({
        ir: ticker.toUpperCase() === "AMD" ? "ir.amd.com" : "investors." + ticker.toLowerCase() + ".com",
        sec: "EDGAR · search “" + ticker.toUpperCase() + "”",
        cadence: "Quarterly (inferred from last 8 filings)",
        window: "predicted ±10 days around prior dates",
      });
      setPhase("found");
    }, 1900);
  }
  function reset() { setAdding(false); setAdvanced(false); setTicker(""); setPhase("idle"); setDiscovered(null); }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">COMPANIES</h1>
          <p className="screen-sub">Configure which companies the agents track, where to look, and how strict validation is.</p>
        </div>
        {!adding && <Btn kind="primary" sm icon="+" onClick={() => setAdding(true)}>ADD COMPANY</Btn>}
      </div>

      {adding && (
        <Panel title="ADD COMPANY" right={<button className="x-btn" onClick={reset}>✕</button>}>
          <div className="add-mode">
            <span className="lbl">SETUP</span>
            <div className="seg">
              <button className={!advanced ? "active" : ""} onClick={() => setAdvanced(false)}>MINIMAL</button>
              <button className={advanced ? "active" : ""} onClick={() => setAdvanced(true)}>ADVANCED</button>
            </div>
            <span className="add-mode-note">{advanced ? "Pin sources & tune validation." : "Just a ticker — the agent finds the rest."}</span>
          </div>

          <div className="add-row">
            <input className="inp" placeholder="Ticker (e.g. AMD)" value={ticker}
              onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startDiscovery()} />
            <Btn kind="primary" sm onClick={startDiscovery} disabled={phase === "discovering"}>
              {phase === "discovering" ? "DISCOVERING…" : "DISCOVER SOURCES"}
            </Btn>
          </div>

          {phase === "discovering" && (
            <ul className="disco">
              <li className="ok">✓ Resolved ticker → company name</li>
              <li className="ok">✓ Located SEC EDGAR CIK</li>
              <li className="run">◴ Scanning investor-relations site…</li>
              <li className="wait">· Inferring reporting cadence</li>
            </ul>
          )}

          {phase === "found" && discovered && (
            <>
              <div className="banner banner-ok"><span>✓ Sources found. Confirm to start watching.</span></div>
              <div className="kv">
                <div><span className="lbl">PRIMARY IR</span><span>{discovered.ir}</span></div>
                <div><span className="lbl">SEC</span><span>{discovered.sec}</span></div>
                <div><span className="lbl">CADENCE</span><span>{discovered.cadence}</span></div>
                <div><span className="lbl">NEXT WINDOW</span><span>{discovered.window}</span></div>
              </div>

              {advanced && (
                <div className="adv-block">
                  <div className="adv-hd">ADVANCED GUIDANCE</div>
                  <label className="adv-field"><span>Pinned source URL (optional)</span><input className="inp" placeholder="https://…/quarterly-results" /></label>
                  <label className="adv-field"><span>Reporting cadence</span>
                    <select className="inp"><option>Quarterly (4×/yr)</option><option>Semi-annual (2×/yr)</option><option>Auto-detect</option></select>
                  </label>
                  <label className="adv-field"><span>Metrics to extract</span>
                    <div className="taglist">{["Revenue","Net income","EPS basic","EPS diluted","Gross margin","Guidance"].map((m,i)=>(<span key={m} className={"tag"+(i<4?" on":"")}>{m}</span>))}</div>
                  </label>
                  <label className="adv-field"><span>Validation rule</span>
                    <select className="inp"><option>Cross-reference EPS in ≥2 locations</option><option>Match press release to 8-K schedule</option><option>None (record as-found)</option></select>
                  </label>
                </div>
              )}

              <div className="add-confirm">
                <Btn kind="primary" onClick={reset} icon="▸">START WATCHING {ticker.toUpperCase()}</Btn>
                <Btn kind="ghost" onClick={reset}>Cancel</Btn>
              </div>
            </>
          )}
        </Panel>
      )}

      <div className="cfg-list">
        {data.companies.map((c) => (
          <div className="cfg-row" key={c.ticker} onClick={() => onOpen(c.ticker)}>
            <Glyph ticker={c.ticker} status={c.status} />
            <div className="cfg-id"><b>{c.ticker}</b><span>{c.name}</span></div>
            <div className="cfg-src">{c.sources.map((s) => <span key={s.label} className="src-pill sm"><b>{s.kind}</b> {s.label}</span>)}</div>
            <span className="cfg-cad">{c.cadence}</span>
            <span className="cfg-mode">mode: {c.sourceMode}</span>
            <StatusChip status={c.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== ACTIVITY ===================== */
function Activity({ data }) {
  const [filter, setFilter] = useState2("all");
  const rows = filter === "all" ? data.activity : data.activity.filter((r) => r.agent === filter);
  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">ACTIVITY LOG</h1>
          <p className="screen-sub">Everything the agents did — transparent and auditable. {data.usage.runs} runs this month.</p>
        </div>
      </div>
      <div className="filt">
        {["all", ...data.companies.map((c) => c.ticker)].map((f) => (
          <button key={f} className={"filt-btn" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
        ))}
      </div>
      <Panel pad={false}><LogList rows={rows} /></Panel>
    </div>
  );
}

/* ===================== SETTINGS ===================== */
function Settings({ data }) {
  const u = data.usage;
  const pct = Math.round((u.monthCost / u.budget) * 100);
  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">SETTINGS</h1>
          <p className="screen-sub">Model & provider routing, schedules, budgets. The agent layer is provider-agnostic — swap models per task.</p>
        </div>
      </div>

      <Panel title="USAGE — this month">
        <div className="usage">
          <div className="usage-big"><span className="ub-val">${u.monthCost.toFixed(2)}</span><span className="ub-lab">of ${u.budget} budget</span></div>
          <div className="usage-bar"><span style={{ width: pct + "%" }} /></div>
          <div className="usage-stats"><span>{u.monthTokens}M tokens</span><span>{u.runs} runs</span><span>{pct}% of budget</span></div>
        </div>
        <div className="usage-models">
          {u.byModel.map((m) => (
            <div className="um-row" key={m.model}><span className="um-name">{m.model}</span><span className="um-task">{m.task}</span><div className="um-bar"><span style={{ width: m.share + "%" }} /></div><span className="um-cost">${m.cost.toFixed(2)}</span></div>
          ))}
        </div>
      </Panel>

      <Panel title="PROVIDERS">
        <div className="prov-grid">
          {data.providers.map((p) => (
            <div className={"prov-card " + p.status} key={p.id}>
              <div className="pc-hd"><span className="pc-name">{p.name}</span><span className={"pc-status " + p.status}>{p.status === "active" ? "● ACTIVE" : "PLANNED"}</span></div>
              <div className="pc-auth">{p.auth}</div>
              <div className="pc-models">{p.models.map((m) => <span key={m} className="pc-model">{m}</span>)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="MODEL ROUTING — per task" right={<span className="hint">cheaper models for cheap work; strong models where it counts</span>}>
        <div className="route">
          {data.routing.map((r) => (
            <div className="route-row" key={r.task}>
              <div className="route-task"><b>{r.task}</b><span>{r.desc}</span></div>
              <div className="seg seg-model">
                {["Claude Haiku 4", "Claude Sonnet 4", "Claude Opus 4"].map((m) => (
                  <button key={m} className={r.model === m ? "active" : ""}>{m.replace("Claude ", "")}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="SCHEDULE & VALIDATION DEFAULTS">
        <div className="kv">
          <div><span className="lbl">POLL FREQUENCY</span><span>Daily 06:00 + every 4h inside a predicted window</span></div>
          <div><span className="lbl">RUN MODE</span><span>Offline / unsupervised — queue conflicts for review</span></div>
          <div><span className="lbl">DEFAULT VALIDATION</span><span>Cross-reference EPS in ≥2 locations</span></div>
          <div><span className="lbl">NOTIFY ON</span><span>New results · validation conflict · budget 80%</span></div>
        </div>
      </Panel>
    </div>
  );
}

Object.assign(window, { Timeline, Review, Companies, Activity, Settings });
