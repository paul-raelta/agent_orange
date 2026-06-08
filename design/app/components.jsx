/* Agent Orange — shared UI primitives. Exported to window for cross-file use. */
const { useState, useEffect, useRef } = React;

/* Status semantics for an agent / company */
const STATUS = {
  validated: { label: "VALIDATED", cls: "st-ok", dot: "var(--green)" },
  review:    { label: "NEEDS REVIEW", cls: "st-review", dot: "var(--blue)" },
  watching:  { label: "WATCHING", cls: "st-watch", dot: "var(--amber)" },
  error:     { label: "ERROR", cls: "st-err", dot: "var(--red)" },
};

function StatusChip({ status, pulse }) {
  const s = STATUS[status] || STATUS.watching;
  return (
    <span className={"chip " + s.cls}>
      <span className={"chip-dot" + (pulse && status === "watching" ? " pulse" : "")} style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

/* Confidence badge: high / med / low */
function Conf({ level, onClick }) {
  const map = { high: ["HIGH", "cf-high"], med: ["MED", "cf-med"], low: ["LOW", "cf-low"] };
  const [lab, cls] = map[level] || map.med;
  return (
    <button className={"conf " + cls + (onClick ? " conf-btn" : "")} onClick={onClick} title="Confidence — click for sources">
      <span className="conf-bars">
        <i className={level === "low" ? "on" : "on"} />
        <i className={level !== "low" ? "on" : ""} />
        <i className={level === "high" ? "on" : ""} />
      </span>
      {lab}
    </button>
  );
}

/* Delta value with up/down coloring */
function Delta({ value, suffix = "%", arrow = true }) {
  if (value === null || value === undefined) return <span className="delta delta-na">—</span>;
  const up = value >= 0;
  return (
    <span className={"delta " + (up ? "delta-up" : "delta-down")}>
      {arrow ? (up ? "▲" : "▼") : up ? "+" : ""}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

/* Tiny inline sparkline (SVG) */
function Spark({ data, w = 96, h = 28, color = "var(--accent)" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}

/* Section panel */
function Panel({ title, right, children, pad = true, className = "" }) {
  return (
    <section className={"panel " + className}>
      {(title || right) && (
        <header className="panel-hd">
          <span className="panel-title">{title}</span>
          <span className="panel-right">{right}</span>
        </header>
      )}
      <div className={pad ? "panel-bd" : "panel-bd nopad"}>{children}</div>
    </section>
  );
}

function Btn({ children, kind = "ghost", sm, onClick, icon, disabled }) {
  return (
    <button className={"btn btn-" + kind + (sm ? " btn-sm" : "")} onClick={onClick} disabled={disabled}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}

function Price({ price, change }) {
  const up = change >= 0;
  return (
    <span className="price">
      <span className="price-val">{price.toFixed(2)}</span>
      <span className={"price-chg " + (up ? "delta-up" : "delta-down")}>
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
      </span>
    </span>
  );
}

/* Right-side slide-over drawer */
function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  return (
    <div className={"drawer-root" + (open ? " open" : "")}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-hd">
          <span className="panel-title">{title}</span>
          <button className="x-btn" onClick={onClose}>✕</button>
        </header>
        <div className="drawer-bd">{children}</div>
      </aside>
    </div>
  );
}

/* Provenance snippet block */
function ProvenanceItem({ p }) {
  return (
    <div className="prov">
      <div className="prov-hd">
        <span className="prov-src">{p.source}</span>
        <span className="prov-page">p.{p.page}</span>
      </div>
      <a className="prov-url" href="#" onClick={(e) => e.preventDefault()}>{p.url}</a>
      <blockquote className="prov-quote">{p.quote}</blockquote>
    </div>
  );
}

/* Ticker glyph (monogram tile) */
function Glyph({ ticker, status }) {
  const s = STATUS[status] || STATUS.watching;
  return (
    <span className="glyph" style={{ "--g": s.dot }}>
      {ticker.slice(0, 2)}
    </span>
  );
}

Object.assign(window, {
  StatusChip, Conf, Delta, Spark, Panel, Btn, Price, Drawer, ProvenanceItem, Glyph, STATUS,
});
