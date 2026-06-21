/* Agent Orange — Add Companies: sector-grouped browse (B) with a table density
   toggle (C), shared multi-select model + sticky tray, then batch source discovery. */
const { useState, useMemo, useEffect, useRef } = React;

const DATA = window.SP500 || [];
const SECTORS = window.SP500_SECTORS || [];
const fmtCap = (b) => (b >= 1000 ? `$${(b / 1000).toFixed(2)}T` : `$${b}B`);
const slug = (n) => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 18);
const hash = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 131 + s.charCodeAt(i)) >>> 0; return x; };

function Glyph({ ticker, sm }) {
  return <div className={"glyph" + (sm ? " sm" : "")}>{ticker.replace(".", "").slice(0, 2)}</div>;
}
function Chg({ v }) {
  const up = v >= 0;
  return <span className={"spc-chg " + (up ? "up" : "down")}>{up ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%</span>;
}

/* ---------- Standard card (grid view) ---------- */
function Card({ c, selected, onToggle }) {
  return (
    <div
      className={"spc" + (selected ? " sel" : "") + (c.tracked ? " tracked" : "")}
      onClick={() => !c.tracked && onToggle(c.ticker)}
    >
      <div className="spc-top">
        <Glyph ticker={c.ticker} />
        <div className="spc-id">
          <div className="spc-tkr">{c.ticker}</div>
          <div className="spc-name">{c.name}</div>
        </div>
        {c.tracked ? (
          <span className="spc-trackchip">TRACKING</span>
        ) : (
          <div className="spc-check">✓</div>
        )}
      </div>
      <div className="spc-mid">
        <span className="spc-price">${c.price.toFixed(2)}</span>
        <Chg v={c.dayChange} />
      </div>
      <div className="spc-foot">
        <span className="spc-cap">{fmtCap(c.mcap)} cap</span>
        <span className="spc-earn">⌚ {c.earn}</span>
      </div>
    </div>
  );
}

/* ---------- Sector-grouped grid (view B) ---------- */
function GridView({ groups, selected, onToggle, onToggleSector, collapsed, onCollapse }) {
  if (!groups.length) return <div className="empty">No companies match your filters.</div>;
  return groups.map(({ sector, items }) => {
    const selCount = items.filter((c) => selected.has(c.ticker)).length;
    const addable = items.filter((c) => !c.tracked);
    const allSel = addable.length > 0 && addable.every((c) => selected.has(c.ticker));
    const isCol = collapsed.has(sector);
    return (
      <div className={"secgroup" + (isCol ? " collapsed" : "")} key={sector}>
        <div className="secgroup-hd" onClick={() => onCollapse(sector)}>
          <span className="sg-caret">▼</span>
          <span className="sg-name">{sector}</span>
          <span className="sg-count">{items.length} cos</span>
          {selCount > 0 && <span className="sg-sel">{selCount} selected</span>}
          <button
            className="sg-selall"
            style={selCount > 0 ? {} : { marginLeft: "auto" }}
            onClick={(e) => { e.stopPropagation(); onToggleSector(addable.map((c) => c.ticker), !allSel); }}
          >
            {allSel ? "Clear sector" : "Select all"}
          </button>
        </div>
        <div className="sg-grid">
          {items.map((c) => (
            <Card key={c.ticker} c={c} selected={selected.has(c.ticker)} onToggle={onToggle} />
          ))}
        </div>
      </div>
    );
  });
}

/* ---------- Table (view C) ---------- */
const COLS = [
  { k: "ticker", label: "Ticker" },
  { k: "name", label: "Company" },
  { k: "sector", label: "Sector" },
  { k: "price", label: "Price", num: true },
  { k: "dayChange", label: "Day", num: true },
  { k: "mcap", label: "Mkt cap", num: true },
  { k: "earnDays", label: "Next rpt", num: true },
];
function TableView({ rows, selected, onToggle, sortKey, sortDir, onSort }) {
  if (!rows.length) return <div className="empty">No companies match your filters.</div>;
  return (
    <div className="tbl-wrap">
      <table className="sp-tbl">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            {COLS.map((col) => (
              <th key={col.k} className={col.num ? "num" : ""} onClick={() => onSort(col.k)}>
                {col.label}
                {sortKey === col.k && <span className="ar">{sortDir === 1 ? "▲" : "▼"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.ticker}
              className={(selected.has(c.ticker) ? "sel " : "") + (c.tracked ? "tracked" : "")}
              onClick={() => !c.tracked && onToggle(c.ticker)}
            >
              <td>{c.tracked ? <span className="spc-trackchip">✓</span> : <div className="tcheck">✓</div>}</td>
              <td className="tk">{c.ticker}</td>
              <td className="nm">{c.name}</td>
              <td className="sc">{c.sector}</td>
              <td className="num">${c.price.toFixed(2)}</td>
              <td className={"num " + (c.dayChange >= 0 ? "up" : "down")}>
                {c.dayChange >= 0 ? "+" : "−"}{Math.abs(c.dayChange).toFixed(2)}%
              </td>
              <td className="num">{fmtCap(c.mcap)}</td>
              <td className="num t-earn">{c.earn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Sticky selection tray ---------- */
function Tray({ selectedList, onRemove, onClear, onAdd }) {
  return (
    <div className={"tray" + (selectedList.length ? " show" : "")}>
      <div className="tray-inner">
        <span className="tray-count"><b>{selectedList.length}</b> selected</span>
        <div className="tray-chips">
          {selectedList.map((t) => (
            <span className="tray-chip" key={t}>
              {t}<span className="x" onClick={() => onRemove(t)}>✕</span>
            </span>
          ))}
        </div>
        <button className="tray-clear" onClick={onClear}>CLEAR</button>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>ADD {selectedList.length} →</button>
      </div>
    </div>
  );
}

/* ====================  STAGE 1: BROWSE  ==================== */
function Browse({ selected, setSelected, onAdd }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState("mcap");
  const [view, setView] = useState("grid");
  const [collapsed, setCollapsed] = useState(new Set());
  const [tSortKey, setTSortKey] = useState("mcap");
  const [tSortDir, setTSortDir] = useState(-1);

  const sectorCounts = useMemo(() => {
    const m = {}; DATA.forEach((c) => (m[c.sector] = (m[c.sector] || 0) + 1)); return m;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DATA.filter(
      (c) => (sector === "All" || c.sector === sector) &&
        (!q || c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
    );
  }, [query, sector]);

  const sortedGrid = useMemo(() => {
    const arr = [...filtered];
    if (sort === "az") arr.sort((a, b) => a.ticker.localeCompare(b.ticker));
    else if (sort === "mcap") arr.sort((a, b) => b.mcap - a.mcap);
    else if (sort === "earn") arr.sort((a, b) => a.earnDays - b.earnDays);
    return arr;
  }, [filtered, sort]);

  const groups = useMemo(() => {
    const order = sector === "All" ? SECTORS : [sector];
    return order
      .map((s) => ({ sector: s, items: sortedGrid.filter((c) => c.sector === s) }))
      .filter((g) => g.items.length);
  }, [sortedGrid, sector]);

  const tableRows = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = a[tSortKey], bv = b[tSortKey];
      if (typeof av === "string") return av.localeCompare(bv) * tSortDir;
      return (av - bv) * tSortDir;
    });
    return arr;
  }, [filtered, tSortKey, tSortDir]);

  const toggle = (t) => setSelected((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleSector = (tickers, on) => setSelected((prev) => {
    const n = new Set(prev); tickers.forEach((t) => (on ? n.add(t) : n.delete(t))); return n;
  });
  const onTSort = (k) => { if (k === tSortKey) setTSortDir((d) => -d); else { setTSortKey(k); setTSortDir(k === "name" || k === "ticker" || k === "sector" ? 1 : -1); } };
  const collapse = (s) => setCollapsed((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const selectedList = [...selected];

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <a className="back" href="#">← Companies</a>
          <h1 className="screen-title">ADD COMPANIES</h1>
          <p className="screen-sub">
            Browse the S&P 500, select the companies you want an agent to monitor, then discover
            their filing sources in one batch.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <span className="ic">⌕</span>
          <input placeholder="Search ticker or company…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value)} title="Sort (grid)">
          <option value="mcap">Sort · Market cap</option>
          <option value="az">Sort · A–Z</option>
          <option value="earn">Sort · Soonest earnings</option>
        </select>
        <div className="seg">
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>GRID</button>
          <button className={view === "table" ? "active" : ""} onClick={() => setView("table")}>TABLE</button>
        </div>
      </div>

      <div className="secfilter">
        <button className={"secchip" + (sector === "All" ? " on" : "")} onClick={() => setSector("All")}>
          All<span className="n">{DATA.length}</span>
        </button>
        {SECTORS.map((s) => (
          <button key={s} className={"secchip" + (sector === s ? " on" : "")} onClick={() => setSector(s)}>
            {s}<span className="n">{sectorCounts[s]}</span>
          </button>
        ))}
      </div>

      <div className="count-line">
        {filtered.length} companies{sector !== "All" ? ` in ${sector}` : ""}
        {query ? ` matching “${query}”` : ""} · {selected.size} selected
      </div>

      {view === "grid" ? (
        <GridView
          groups={groups} selected={selected} onToggle={toggle}
          onToggleSector={toggleSector} collapsed={collapsed} onCollapse={collapse}
        />
      ) : (
        <TableView
          rows={tableRows} selected={selected} onToggle={toggle}
          sortKey={tSortKey} sortDir={tSortDir} onSort={onTSort}
        />
      )}

      <Tray
        selectedList={selectedList}
        onRemove={(t) => toggle(t)}
        onClear={() => setSelected(new Set())}
        onAdd={onAdd}
      />
    </div>
  );
}

/* ====================  STAGE 2: DISCOVER  ==================== */
const STEPS = ["Resolving ticker → company", "Locating SEC EDGAR CIK", "Scanning investor-relations site", "Inferring reporting cadence"];

function Discover({ companies, onBack, onConfirmAll }) {
  const [prog, setProg] = useState(() => Object.fromEntries(companies.map((c) => [c.ticker, { step: -1, status: "queued" }])));
  const [picks, setPicks] = useState({});
  const timers = useRef([]);

  useEffect(() => {
    companies.forEach((c, i) => {
      const needsConfirm = hash(c.ticker) % 6 === 0 && !c.tracked;
      const start = 200 + i * 280;
      for (let s = 0; s < STEPS.length; s++) {
        timers.current.push(setTimeout(() => {
          setProg((p) => ({ ...p, [c.ticker]: { step: s, status: "run" } }));
        }, start + s * 520));
      }
      timers.current.push(setTimeout(() => {
        setProg((p) => ({ ...p, [c.ticker]: { step: STEPS.length, status: needsConfirm ? "confirm" : "found" } }));
      }, start + STEPS.length * 520));
    });
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const done = companies.filter((c) => { const st = prog[c.ticker]?.status; return st === "found" || st === "confirm"; }).length;
  const unresolved = companies.filter((c) => prog[c.ticker]?.status === "confirm" && !picks[c.ticker]).length;
  const pct = Math.round((done / companies.length) * 100);

  const sources = (c) => {
    const cik = String(1000000 + (hash(c.ticker) % 8999999)).padStart(10, "0");
    return { ir: `investors.${slug(c.name)}.com`, sec: `CIK ${cik}`, cadence: hash(c.ticker) % 9 === 0 ? "Semi-annual" : "Quarterly" };
  };

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <a className="back" href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>← Back to selection</a>
          <h1 className="screen-title">DISCOVER SOURCES</h1>
          <p className="screen-sub">
            Each agent locates where its company's results live — IR site + SEC EDGAR — and infers
            the reporting cadence. Ambiguous IR sites are flagged for a quick confirm.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="lbl">PROGRESS</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{done} / {companies.length}</div>
        </div>
      </div>

      <div className="disc-prog"><span style={{ width: pct + "%" }}></span></div>

      {companies.map((c) => {
        const st = prog[c.ticker] || { step: -1, status: "queued" };
        const src = sources(c);
        const rowCls = st.status === "found" ? "done" : st.status === "confirm" ? "confirm" : "";
        return (
          <div className={"disc-row " + rowCls} key={c.ticker}>
            <div className="disc-hd">
              <div className="disc-id">
                <Glyph ticker={c.ticker} sm />
                <div style={{ minWidth: 0 }}>
                  <div className="disc-tkr">{c.ticker}</div>
                  <div className="disc-nm">{c.name}</div>
                </div>
              </div>

              {st.status === "found" || st.status === "confirm" ? (
                <div className="disc-found">
                  <span className="src-pill primary sm"><b>IR</b> {src.ir}</span>
                  <span className="src-pill sm"><b>SEC</b> {src.sec}</span>
                  <span className="src-pill sm">{src.cadence}</span>
                </div>
              ) : (
                <div className="disc-steps">
                  {STEPS.map((label, i) => {
                    const cls = st.step > i ? "ok" : st.step === i ? "run" : "";
                    if (st.step < i) return null;
                    return (
                      <div className={"disc-step " + cls} key={i}>
                        <span className="b">{st.step > i ? "✓" : <span className="spin">◴</span>}</span> {label}
                      </div>
                    );
                  })}
                  {st.status === "queued" && <div className="disc-step">· Queued</div>}
                </div>
              )}

              <div className="disc-state">
                {st.status === "found" && <span className="statechip found">✓ SOURCES FOUND</span>}
                {st.status === "confirm" && (picks[c.ticker]
                  ? <span className="statechip found">✓ CONFIRMED</span>
                  : <span className="statechip confirm">⚑ CONFIRM IR</span>)}
                {(st.status === "run" || st.status === "queued") && (
                  <span className="statechip run"><span className="pulse-dot" style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }}></span>READING</span>
                )}
              </div>
            </div>

            {st.status === "confirm" && !picks[c.ticker] && (
              <div className="disc-confirm">
                Two plausible IR pages found — pick the one the agent should pin as primary:
                <div className="cands">
                  {[
                    { u: `investors.${slug(c.name)}.com/quarterly-results`, w: "Linked from EDGAR · earnings releases" },
                    { u: `${slug(c.name)}.com/news/press-releases`, w: "Newsroom · mixed press releases" },
                  ].map((cand, i) => (
                    <div className="cand" key={i} onClick={() => setPicks((p) => ({ ...p, [c.ticker]: i }))}>
                      <div className="u">{cand.u}</div>
                      <div className="w">{cand.w}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
        <button
          className="btn btn-primary"
          disabled={done < companies.length || unresolved > 0}
          onClick={onConfirmAll}
        >
          ▸ START WATCHING ALL ({companies.length})
        </button>
        <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
        {unresolved > 0 && <span style={{ fontSize: 10.5, color: "var(--amber)" }}>{unresolved} need IR confirmation</span>}
        {done < companies.length && <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>discovering…</span>}
      </div>
    </div>
  );
}

/* ====================  ROOT  ==================== */
function App() {
  const [stage, setStage] = useState("browse");
  const [selected, setSelected] = useState(new Set());
  const selectedCompanies = useMemo(() => DATA.filter((c) => selected.has(c.ticker)), [selected]);

  if (stage === "discover")
    return <Discover companies={selectedCompanies} onBack={() => setStage("browse")} onConfirmAll={() => setStage("done")} />;

  if (stage === "done")
    return (
      <div className="screen">
        <div className="done-hero">
          <div className="big" style={{ color: "var(--green)" }}>✓ Now watching {selectedCompanies.length} companies</div>
          <div className="sub">
            Agents are live. They'll poll each company's sources on schedule, extract and cross-validate
            the headline figures, and notify you the moment results drop.
          </div>
          <button className="btn btn-primary" onClick={() => { setSelected(new Set()); setStage("browse"); }}>
            ← Add more
          </button>
        </div>
      </div>
    );

  return <Browse selected={selected} setSelected={setSelected} onAdd={() => selected.size && setStage("discover")} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
