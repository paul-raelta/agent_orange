/* Agent Orange — Watchlist + Company deep-dive screens. */
const { useState: useState1 } = React;

/* ===================== WATCHLIST (main) ===================== */
function Watchlist({ data, onOpen, onReview, onRunAll, lastSync, running }) {
  const counts = data.companies.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {});
  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">WATCHLIST</h1>
          <p className="screen-sub">
            {data.companies.length} agents ·{" "}
            <span className="s-watch">{counts.watching || 0} watching</span> ·{" "}
            <span className="s-review">{counts.review || 0} needs review</span> ·{" "}
            <span className="s-ok">{counts.validated || 0} validated</span>
          </p>
        </div>
        <div className="screen-actions">
          <span className="sync">last sync {lastSync}</span>
          <Btn kind="primary" sm onClick={onRunAll} icon={running ? "◴" : "▸"}>
            {running ? "RUNNING…" : "RUN ALL AGENTS"}
          </Btn>
        </div>
      </div>

      <div className="wl-grid">
        {data.companies.map((c) => (
          <CompanyCard key={c.ticker} c={c} onOpen={() => onOpen(c.ticker)} onReview={onReview} />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({ c, onOpen, onReview }) {
  const L = c.latest;
  return (
    <article className={"wl-card status-" + c.status} onClick={onOpen}>
      <div className="wl-card-top">
        <div className="wl-id">
          <Glyph ticker={c.ticker} status={c.status} />
          <div>
            <div className="wl-ticker">{c.ticker}</div>
            <div className="wl-name">{c.name}</div>
          </div>
        </div>
        <StatusChip status={c.status} pulse />
      </div>

      <div className="wl-pricerow">
        <Price price={c.price} change={c.dayChange} />
        <Spark data={c.sparkEps} color="var(--accent)" />
      </div>

      <div className="wl-period">
        <span className="wl-period-lab">{c.status === "watching" ? "LAST REPORTED" : "LATEST"}</span>
        <span className="wl-period-val">{L.period}</span>
        <span className="wl-period-end">ended {L.periodEnd}</span>
      </div>

      <div className="wl-metrics">
        {L.metrics.slice(0, 3).map((m) => (
          <div className="wl-metric" key={m.key}>
            <div className="wl-metric-top">
              <span className="wl-metric-key">{m.key}</span>
              <Conf level={m.conf} />
            </div>
            <div className="wl-metric-val">{m.value}</div>
            <Delta value={m.yoy} />
          </div>
        ))}
      </div>

      <div className="wl-foot">
        {c.status === "review" ? (
          <button className="wl-foot-cta review" onClick={(e) => { e.stopPropagation(); onReview(); }}>
            ⚑ 2 items need your review →
          </button>
        ) : c.status === "watching" ? (
          <span className="wl-foot-note">
            <span className="chip-dot pulse" style={{ background: "var(--amber)" }} /> {c.nextWindow.label} · {c.nextWindow.from}–{c.nextWindow.to}
          </span>
        ) : (
          <span className="wl-foot-note ok">✓ {L.validation.corroborations}× corroborated · validated {L.validatedOn}</span>
        )}
      </div>
    </article>
  );
}

/* ===================== COMPANY DEEP-DIVE ===================== */
function Company({ c, onBack, onReview }) {
  const [tab, setTab] = useState1("results");
  const [prov, setProv] = useState1(null); // metric object for drawer
  const L = c.latest;

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>← Watchlist</button>

      <div className="co-hd">
        <div className="wl-id">
          <Glyph ticker={c.ticker} status={c.status} />
          <div>
            <div className="co-ticker">{c.ticker} <span className="co-sector">{c.sector}</span></div>
            <div className="wl-name">{c.name} · {c.cadence} · {c.fiscalNote}</div>
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
          <span key={s.label} className={"src-pill" + (s.primary ? " primary" : "")}>
            <b>{s.kind}</b> {s.label}{s.primary ? " · primary" : ""}
          </span>
        ))}
        <span className="src-mode">mode: {c.sourceMode}</span>
      </div>

      {c.status === "review" && (
        <div className="banner banner-review">
          <span>⚑ This company has unresolved findings.</span>
          <Btn kind="review" sm onClick={onReview}>OPEN REVIEW QUEUE →</Btn>
        </div>
      )}

      <div className="tabs">
        {["results", "validation", "agent runs"].map((t) => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
        ))}
      </div>

      {tab === "results" && (
        <Panel title={"QUARTERLY RESULTS — last " + c.history.length + " periods"} pad={false}>
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
                {[
                  ["Revenue", "rev"], ["Net income", "ni"], ["EPS · diluted", "epsD"], ["EPS · basic", "epsB"], ["Gross margin", "gm"],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <td className="sticky-col rowlab">{label}</td>
                    {c.history.map((h, i) => (
                      <td key={i} className={i === 0 ? "cell-latest" : ""}>
                        <span className="cell-val">{h[key]}</span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="sticky-col rowlab dim">confidence</td>
                  {c.history.map((h, i) => (
                    <td key={i} className={i === 0 ? "cell-latest" : ""}>
                      <Conf level={h.conf} onClick={i === 0 ? () => setProv(L.metrics[2]) : undefined} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="tbl-note">Click a confidence badge on the latest column to inspect where each number was found.</div>
        </Panel>
      )}

      {tab === "validation" && (
        <Panel title="VALIDATION — latest period">
          <div className={"val-card " + (L.validation.passed ? "pass" : "fail")}>
            <div className="val-top">
              <span className={"val-badge " + (L.validation.passed ? "pass" : "fail")}>
                {L.validation.passed ? "✓ PASSED" : "⚑ NEEDS REVIEW"}
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
              <div className="metric-row" key={m.key} onClick={() => m.prov.length && setProv(m)}>
                <span className="mr-key">{m.key}</span>
                <span className="mr-val">{m.value}</span>
                <Delta value={m.yoy} />
                <Conf level={m.conf} onClick={m.prov.length ? () => setProv(m) : undefined} />
                <span className="mr-prov">{m.prov.length} source{m.prov.length === 1 ? "" : "s"} ›</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "agent runs" && (
        <Panel title="AGENT RUNS — this company" pad={false}>
          <LogList rows={window.AO_DATA.activity.filter((a) => a.agent === c.ticker)} />
        </Panel>
      )}

      <Drawer open={!!prov} onClose={() => setProv(null)} title={prov ? "PROVENANCE · " + prov.key : ""}>
        {prov && (
          <>
            <div className="drawer-metric">
              <span className="dm-val">{prov.value}</span>
              <Conf level={prov.conf} />
              <span className="dm-yoy"><Delta value={prov.yoy} /> YoY</span>
            </div>
            <p className="drawer-help">
              Every figure links back to the exact place the agent read it. Multiple agreeing sources raise confidence; conflicts drop it and route to review.
            </p>
            {prov.prov.length ? prov.prov.map((p, i) => <ProvenanceItem key={i} p={p} />) : <p className="drawer-help">No source captured.</p>}
          </>
        )}
      </Drawer>
    </div>
  );
}

/* shared log list (used by company + activity screen) */
function LogList({ rows }) {
  return (
    <ul className="log">
      {rows.map((r, i) => (
        <li key={i} className={"log-row lvl-" + r.level}>
          <span className="log-t">{r.t}</span>
          <span className={"log-agent ag-" + r.agent}>{r.agent}</span>
          <span className="log-msg">{r.msg}</span>
          <span className="log-cost">{(r.tokens / 1000).toFixed(1)}k tok · ${r.cost.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

Object.assign(window, { Watchlist, Company, LogList });
