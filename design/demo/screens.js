/* Agent Orange — faithful screen builders for the demo.
   Vanilla functions returning HTML strings that mirror the production TSX
   markup + classNames exactly, so the rebuilt screens are pixel-faithful to
   the deployed app. The director swaps these into #appmount by time. */
(function () {
  const D = window.DEMO;

  const STATUS = {
    validated: { label: "VALIDATED", cls: "st-ok", dot: "var(--green)" },
    review: { label: "NEEDS REVIEW", cls: "st-review", dot: "var(--blue)" },
    watching: { label: "WATCHING", cls: "st-watch", dot: "var(--amber)" },
  };

  function fmtMoney(n) {
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(2) + "k";
    return "$" + n.toFixed(2);
  }

  // ---- primitives ----
  function glyph(ticker, status) {
    const s = STATUS[status];
    return `<span class="glyph" style="--g:${s.dot}">${ticker.slice(0, 2)}</span>`;
  }
  function statusChip(status, pulse) {
    const s = STATUS[status];
    const dotCls = "chip-dot" + (pulse && status === "watching" ? " pulse" : "");
    return `<span class="chip ${s.cls}"><span class="${dotCls}" style="background:${s.dot}"></span>${s.label}</span>`;
  }
  function conf(level, btn) {
    const map = { high: ["HIGH", "cf-high"], med: ["MED", "cf-med"], low: ["LOW", "cf-low"] };
    const [lab, cls] = map[level] || map.med;
    return `<button class="conf ${cls}${btn ? " conf-btn" : ""}">
      <span class="conf-bars"><i class="on"></i><i class="${level !== "low" ? "on" : ""}"></i><i class="${level === "high" ? "on" : ""}"></i></span>${lab}
    </button>`;
  }
  function delta(value) {
    if (value === null || value === undefined) return `<span class="delta delta-na">—</span>`;
    const up = value >= 0;
    return `<span class="delta ${up ? "delta-up" : "delta-down"}">${up ? "▲" : "▼"}${Math.abs(value).toFixed(1)}%</span>`;
  }
  function price(p, change) {
    const up = change >= 0;
    return `<span class="price"><span class="price-val">${p.toFixed(2)}</span><span class="price-chg ${up ? "delta-up" : "delta-down"}">${up ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%</span></span>`;
  }
  function spark(data, color) {
    color = color || "var(--accent)";
    const w = 96, h = 28;
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1, step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const last = pts[pts.length - 1];
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="${color}"/></svg>`;
  }
  function panel(title, right, body, pad) {
    const hd = title || right ? `<header class="panel-hd"><span class="panel-title">${title || ""}</span><span class="panel-right">${right || ""}</span></header>` : "";
    return `<section class="panel">${hd}<div class="panel-bd${pad === false ? " nopad" : ""}">${body}</div></section>`;
  }
  function provItem(p) {
    return `<div class="prov"><div class="prov-hd"><span class="prov-src">${p.source}</span><span class="prov-page">p.${p.page}</span></div>
      <a class="prov-url" href="#" onclick="return false">${p.url}</a><blockquote class="prov-quote">${p.quote}</blockquote></div>`;
  }

  // ---- app shell ----
  const NAV = [
    ["watchlist", "Watchlist", "▦"], ["timeline", "Timeline", "▭"], ["review", "Review", "⚑"],
    ["companies", "Companies", "≣"], ["activity", "Activity", "≁"], ["settings", "Settings", "⚙"],
  ];
  function shell(active, content) {
    const items = NAV.map(([id, label, icon]) => {
      const badge = id === "review" ? `<span class="nav-badge">1</span>` : "";
      return `<li><div class="nav-item${active === id ? " active" : ""}" data-nav="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${badge}</div></li>`;
    }).join("");
    return `<div class="app-shell">
      <nav class="nav">
        <div class="nav-brand"><span class="brand-mark"></span><span class="brand-text">AGENT<br><b>ORANGE</b></span></div>
        <ul class="nav-list">${items}</ul>
        <div class="nav-foot"><div class="nav-usage">
          <div class="nu-top"><span>OPUS&nbsp;4</span><span class="nu-dot"></span></div>
          <div class="nu-bar"><span style="width:37%"></span></div>
          <div class="nu-lab">$19 / $50 · 1.24M tok</div>
        </div></div>
      </nav>
      <main class="content" id="content">${content}</main>
    </div>`;
  }

  // ---- Watchlist ----
  function watchlistCard(c) {
    const L = c.latest;
    const pos = c.portfolio.shares > 0 ? `<div class="wl-position"><span class="lbl">POSITION</span><span class="wl-position-val">${fmtMoney(c.portfolio.value)}</span><span class="wl-position-pl ${c.portfolio.unrealized >= 0 ? "delta-up" : "delta-down"}">${c.portfolio.unrealized >= 0 ? "▲" : "▼"} ${Math.abs(c.portfolio.unrealizedPct).toFixed(1)}%</span></div>` : "";
    const metrics = L.metrics.slice(0, 3).map((m) => `<div class="wl-metric"><div class="wl-metric-top"><span class="wl-metric-key">${m.key}</span>${conf(m.conf)}</div><div class="wl-metric-val">${m.value}</div>${delta(m.yoy)}</div>`).join("");
    let foot;
    if (c.status === "review") foot = `<button class="wl-foot-cta review">⚑ 1 item needs your review →</button>`;
    else if (c.status === "watching") foot = `<span class="wl-foot-note"><span class="chip-dot pulse" style="background:var(--amber)"></span> ${c.nextWindow.label} · ${c.nextWindow.from}–${c.nextWindow.to}</span>`;
    else foot = `<span class="wl-foot-note ok">✓ ${L.validation.corroborations}× corroborated · validated ${c.validatedOn}</span>`;
    return `<article class="wl-card status-${c.status}" data-card="${c.ticker}">
      <div class="wl-card-top"><div class="wl-id">${glyph(c.ticker, c.status)}<div><div class="wl-ticker">${c.ticker}</div><div class="wl-name">${c.name}</div></div></div>${statusChip(c.status, true)}</div>
      <div class="wl-pricerow">${price(c.price, c.dayChange)}${spark(c.sparkEps)}</div>
      ${pos}
      <div class="wl-period"><span class="wl-period-lab">${c.status === "watching" ? "LAST REPORTED" : "LATEST"}</span><span class="wl-period-val">${L.period}</span><span class="wl-period-end">ended ${L.periodEnd}</span></div>
      <div class="wl-metrics">${metrics}</div>
      <div class="wl-foot">${foot}</div>
    </article>`;
  }
  function watchlist(p) {
    p = p || {};
    const cs = D.order.map((t) => D.companies[t]);
    const counts = cs.reduce((a, c) => ((a[c.status] = (a[c.status] || 0) + 1), a), {});
    const t = D.portfolioTotals;
    const running = p.running;
    return shell("watchlist", `<div class="screen">
      <div class="screen-hd">
        <div><h1 class="screen-title">WATCHLIST</h1>
          <p class="screen-sub">${cs.length} agents · <span class="s-watch">${counts.watching || 0} watching</span> · <span class="s-review">${counts.review || 0} needs review</span> · <span class="s-ok">${counts.validated || 0} validated</span></p>
        </div>
        <div class="screen-actions"><span class="sync">last sync ${running ? "just now" : "Jul 30 · 09:12"}</span>
          <button class="btn btn-primary btn-sm" data-run><span class="btn-icon">${running ? "◴" : "▸"}</span>${running ? "RUNNING…" : "RUN ALL AGENTS"}</button>
        </div>
      </div>
      <div class="pf-strip">
        <div class="pf-cell"><span class="lbl">PORTFOLIO</span><span class="pf-val">${fmtMoney(t.totalValue)}</span></div>
        <div class="pf-cell"><span class="lbl">COST</span><span class="pf-val pf-val-dim">${fmtMoney(t.totalCost)}</span></div>
        <div class="pf-cell"><span class="lbl">UNREALIZED</span><span class="pf-val ${t.unrealized >= 0 ? "delta-up" : "delta-down"}">${t.unrealized >= 0 ? "▲" : "▼"} ${fmtMoney(Math.abs(t.unrealized))}<span class="pf-pct"> +${t.unrealizedPct.toFixed(1)}%</span></span></div>
      </div>
      <div class="wl-grid">${cs.map(watchlistCard).join("")}</div>
    </div>`);
  }

  // ---- Company deep-dive ----
  const TABS = ["results", "validation", "news", "insider", "agent runs"];
  const ROWS = [["Revenue", "rev"], ["Net income", "ni"], ["EPS · diluted", "epsD"], ["EPS · basic", "epsB"], ["Gross margin", "gm"]];
  const PLANNED = [
    ["Forward guidance", "Next-quarter / full-year revenue + EPS guidance."],
    ["Segment breakdowns", "Revenue by segment, geography and product line."],
    ["Earnings transcripts", "Pull the call, summarize Q&A themes."],
    ["Consensus vs actual", "Beat / miss vs Wall Street estimates."],
  ];
  function company(p) {
    const c = D.companies[p.ticker];
    const tab = p.tab || "results";
    const L = c.latest;
    const pf = c.portfolio;
    const srcs = c.sources.map((s) => `<span class="src-pill${s.primary ? " primary" : ""}"><b>${s.kind}</b> ${s.label}${s.primary ? " · primary" : ""}</span>`).join("");
    const narrative = c.narrative ? `<div class="ai-narrative"><span class="ai-narrative-lbl">WHAT'S WORTH KNOWING</span><p class="ai-narrative-text">${c.narrative}</p></div>` : "";
    const tabBtns = TABS.map((t) => `<button class="tab${tab === t ? " active" : ""}" data-tab="${t}">${t.toUpperCase()}</button>`).join("");

    let body = "";
    if (tab === "results") {
      const head = c.history.map((h) => `<th><div class="th-period">${h.period}</div><div class="th-end">${h.end}</div></th>`).join("");
      const rows = ROWS.map(([label, key]) => `<tr><td class="sticky-col rowlab">${label}</td>${c.history.map((h, i) => `<td class="${i === 0 ? "cell-latest" : ""}"><span class="cell-val">${h[key]}</span></td>`).join("")}</tr>`).join("");
      const confRow = `<tr><td class="sticky-col rowlab dim">confidence</td>${c.history.map((h, i) => `<td class="${i === 0 ? "cell-latest" : ""}">${conf(h.conf, i === 0)}</td>`).join("")}</tr>`;
      const planned = PLANNED.map(([n, d]) => `<div class="planned-tile"><div class="planned-tile-hd"><span class="planned-tile-name">${n}</span><span class="planned-tile-badge">PLANNED</span></div><div class="planned-tile-desc">${d}</div></div>`).join("");
      body = panel(`QUARTERLY RESULTS — last ${c.history.length} periods`, "", `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="sticky-col">METRIC</th>${head}</tr></thead><tbody>${rows}${confRow}</tbody></table></div><div class="tbl-note">Click a confidence badge on the latest column to inspect where each number was found.</div>`, false)
        + `<div class="lbl" style="margin-bottom:8px">FUTURE FEATURES — PLANNED</div><div class="planned-row">${planned}</div>`;
    } else if (tab === "validation") {
      const v = L.validation;
      const metricRows = L.metrics.map((m) => `<div class="metric-row" data-metric="${m.key}"><span class="mr-key">${m.key}</span><span class="mr-val">${m.value}</span>${delta(m.yoy)}${conf(m.conf, m.prov.length > 0)}<span class="mr-prov">${m.prov.length} source${m.prov.length === 1 ? "" : "s"} ›</span></div>`).join("");
      body = panel("VALIDATION — latest period", "", `<div class="val-card ${v.passed ? "pass" : "fail"}"><div class="val-top"><span class="val-badge ${v.passed ? "pass" : "fail"}">${v.passed ? "✓ PASSED" : "⚑ NEEDS REVIEW"}</span><span class="val-rule">rule · ${v.rule}</span></div><p class="val-detail">${v.detail}</p><div class="val-meta"><span>${v.corroborations} corroborating source(s)</span>${v.conflict ? `<span class="val-conflict">value conflict detected</span>` : ""}</div></div><div class="metric-list">${metricRows}</div>`);
    } else if (tab === "news") {
      const list = c.news.length ? `<div class="news-list">${c.news.map((n) => `<div class="news-row"><span class="news-t">${n.ts}</span><span class="news-src">${n.source}</span><div class="news-body"><a class="news-headline" href="#" onclick="return false">${n.headline}</a><div class="news-summary">${n.summary}</div></div></div>`).join("")}</div>` : `<div class="empty">No news yet.</div>`;
      body = panel("RECENT NEWS — last 30 days", "", list, false);
    }

    // drawer
    let drawer = "";
    const dk = p.drawerKey;
    if (dk) {
      const m = L.metrics.find((x) => x.key === dk);
      const provs = m && m.prov.length ? m.prov.map(provItem).join("") : `<p class="drawer-help">No source captured.</p>`;
      drawer = `<div class="drawer-root open"><div class="drawer-scrim"></div><aside class="drawer"><header class="drawer-hd"><span class="panel-title">PROVENANCE · ${dk}</span><button class="x-btn">✕</button></header><div class="drawer-bd">
        <div class="drawer-metric"><span class="dm-val">${m.value}</span>${conf(m.conf)}<span class="dm-yoy">${delta(m.yoy)} YoY</span></div>
        <p class="drawer-help">Every figure links back to the exact place the agent read it. Multiple agreeing sources raise confidence; conflicts drop it and route to review.</p>${provs}</div></aside></div>`;
    }

    const banner = c.status === "review" ? `<div class="banner banner-review"><span>⚑ This company has unresolved findings.</span><button class="btn btn-review btn-sm">OPEN REVIEW QUEUE →</button></div>` : "";

    return shell("watchlist", `<div class="screen">
      <button class="back" data-nav="watchlist">← Watchlist</button>
      <div class="co-hd"><div class="wl-id">${glyph(c.ticker, c.status)}<div><div class="co-ticker">${c.ticker} <span class="co-sector">${c.sector}</span></div><div class="wl-name">${c.name} · ${c.cadence} · ${c.fiscalNote}</div></div></div><div class="co-hd-right">${price(c.price, c.dayChange)}${statusChip(c.status, true)}</div></div>
      <div class="co-srcrow"><span class="lbl">SOURCES</span>${srcs}<span class="src-mode">mode: ${c.sourceMode}</span></div>
      ${narrative}
      <div class="pf-edit">
        <div class="pf-edit-field"><span class="lbl">SHARES</span><input type="text" value="${pf.shares || ""}" readonly></div>
        <div class="pf-edit-field"><span class="lbl">COST BASIS / SHARE</span><input type="text" value="${pf.shares ? (((pf.value - pf.unrealized) / pf.shares).toFixed(2)) : ""}" readonly></div>
        <button class="btn btn-primary btn-sm">SAVE</button>
        <div class="pf-edit-stats"><span class="lbl">POSITION</span><span class="pf-edit-val">${fmtMoney(pf.value)}</span><span class="${pf.unrealized >= 0 ? "delta-up" : "delta-down"}">${pf.unrealized >= 0 ? "▲" : "▼"} ${fmtMoney(Math.abs(pf.unrealized))} · ${pf.unrealized >= 0 ? "+" : "−"}${Math.abs(pf.unrealizedPct).toFixed(1)}%</span></div>
      </div>
      ${banner}
      <div class="tabs">${tabBtns}</div>
      ${body}
    </div>${drawer}`);
  }

  // ---- Review queue ----
  function review(p) {
    p = p || {};
    const it = D.reviewItem;
    const done = p.resolved;
    const pending = done ? 0 : 1;
    const cands = it.candidates.map((cd, i) => `<label class="rv-cand${done === cd.value ? " chosen" : ""}"><span class="rv-cand-val">${cd.value}</span><span class="rv-cand-src">${cd.source}</span><span class="rv-cand-weight">${cd.weight}</span></label>`).join("");
    const actions = done
      ? `<div class="rv-done">✓ Recorded <b>${done === "reject" ? "— rejected" : done}</b> · removed from queue</div>`
      : `<div class="rv-actions">${it.candidates.map((cd, i) => `<button class="btn btn-${i === 0 ? "primary" : "ghost"} btn-sm" data-use="${cd.value}">USE ${cd.value}</button>`).join("")}<button class="btn btn-danger btn-sm" data-use="reject">REJECT</button></div>`;
    return shell("review", `<div class="screen">
      <div class="screen-hd"><div><h1 class="screen-title">REVIEW QUEUE</h1><p class="screen-sub">${pending} finding${pending === 1 ? "" : "s"} need a human decision before they're recorded.</p></div></div>
      <div class="rv-list"><article class="rv-card${done ? " resolved" : ""}" data-rv>
        <div class="rv-hd"><span class="rv-ticker">${it.ticker}</span><span class="rv-period">${it.period} · ended ${it.periodEnd}</span>${conf(it.conf)}<span class="rv-found">found ${it.foundOn}</span></div>
        <div class="rv-reason"><b>${it.field}</b> — ${it.reason}</div>
        <div class="rv-candidates">${cands}</div>
        ${provItem(it.snippet)}
        ${actions}
      </article></div>
    </div>`);
  }

  // ---- Timeline ----
  const MONTHS = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const TODAY = 3.3;
  const LANES = [
    { ticker: "NVDA", status: "validated", bars: [{ type: "reported", at: 1.0, label: "Q1 FY26 · May 27" }, { type: "window", from: 4.2, to: 4.9, label: "Q2 FY26 expected" }] },
    { ticker: "SNDK", status: "review", bars: [{ type: "reported", at: 3.4, label: "Q4 · Jul 30 ⚑" }, { type: "window", from: 6.5, to: 7.1, label: "Q1 expected" }] },
    { ticker: "MU", status: "watching", bars: [{ type: "reported", at: 1.5, label: "Q3 FY26 · Jun 25" }, { type: "watching", from: 4.9, to: 5.6, label: "Q4 — watching" }] },
  ];
  function timeline() {
    const colW = 100 / MONTHS.length;
    const head = `<div class="tl-head"><div class="tl-lanelabel"></div><div class="tl-track">${MONTHS.map((m) => `<div class="tl-month" style="width:${colW}%">${m} <span>’26</span></div>`).join("")}<div class="tl-now" style="left:${(TODAY + 0.5) * colW}%"><span>NOW</span></div></div></div>`;
    const lanes = LANES.map((ln) => {
      const bars = ln.bars.map((b) => b.type === "reported"
        ? `<div class="tl-marker" style="left:${(b.at + 0.5) * colW}%"><span class="tl-dot"></span><span class="tl-mlabel">${b.label}</span></div>`
        : `<div class="tl-bar ${b.type === "watching" ? "watching" : "window"}" style="left:${(b.from + 0.5) * colW}%;width:${(b.to - b.from) * colW}%"><span class="tl-blabel">${b.label}</span></div>`).join("");
      return `<div class="tl-lane" data-card="${ln.ticker}"><div class="tl-lanelabel">${glyph(ln.ticker, ln.status)}<span>${ln.ticker}</span></div><div class="tl-track"><div class="tl-now-line" style="left:${(TODAY + 0.5) * colW}%"></div>${bars}</div></div>`;
    }).join("");
    const legend = `<div class="tl-legend"><span><i class="lg lg-reported"></i> reported & recorded</span><span><i class="lg lg-window"></i> predicted window</span><span><i class="lg lg-watching"></i> watching now</span></div>`;
    return shell("timeline", `<div class="screen">
      <div class="screen-hd"><div><h1 class="screen-title">FILING TIMELINE</h1><p class="screen-sub">Predicted windows from each company's historical cadence. Agents start watching at the left edge of a window.</p></div></div>
      ${panel("", "", `<div class="tl">${head}${lanes}</div>${legend}`, false)}
    </div>`);
  }

  // ---- Settings ----
  const MODELS = ["Claude Haiku 4", "Claude Sonnet 4", "Claude Opus 4"];
  function settings() {
    const u = D.usage, pct = Math.round((u.monthCost / u.budget) * 100);
    const usagePanel = panel("USAGE — this month", "", `<div class="usage"><div class="usage-big"><span class="ub-val">$${u.monthCost.toFixed(2)}</span><span class="ub-lab">of $${u.budget} budget</span></div><div class="usage-bar"><span style="width:${pct}%"></span></div><div class="usage-stats"><span>${u.monthTokens}M tokens</span><span>${u.runs} runs</span><span>${pct}% of budget</span></div></div><div class="usage-models">${u.byModel.map((m) => `<div class="um-row"><span class="um-name">${m.model}</span><span class="um-task">${m.task}</span><div class="um-bar"><span style="width:${m.share}%"></span></div><span class="um-cost">$${m.cost.toFixed(2)}</span></div>`).join("")}</div>`);
    const provPanel = panel("PROVIDERS", "", `<div class="prov-grid">${D.providers.map((p) => `<div class="prov-card ${p.status}"><div class="pc-hd"><span class="pc-name">${p.name}</span><span class="pc-status ${p.status}">${p.status === "active" ? "● ACTIVE" : "PLANNED"}</span></div><div class="pc-auth">${p.auth}</div><div class="pc-models">${p.models.map((m) => `<span class="pc-model">${m}</span>`).join("")}</div></div>`).join("")}</div>`);
    const routePanel = panel("MODEL ROUTING — per task", `<span class="hint">cheaper models for cheap work; strong models where it counts</span>`, `<div class="route">${D.routing.map((r) => `<div class="route-row"><div class="route-task"><b>${r.task}</b><span>${r.desc}</span></div><div class="seg seg-model">${MODELS.map((m) => `<button class="${r.model === m ? "active" : ""}">${m.replace("Claude ", "")}</button>`).join("")}</div></div>`).join("")}</div>`);
    return shell("settings", `<div class="screen">
      <div class="screen-hd"><div><h1 class="screen-title">SETTINGS</h1><p class="screen-sub">Model &amp; provider routing, notifications, schedules, budgets. The agent layer is provider-agnostic — swap models per task.</p></div></div>
      ${usagePanel}${provPanel}${routePanel}
    </div>`);
  }

  // ---- Activity ----
  function activity() {
    const rows = D.activity.map((r) => `<li class="log-row lvl-${r.level}"><span class="log-t">${r.t}</span><span class="log-agent ag-${r.agent}">${r.agent}</span><span class="log-msg">${r.msg}</span><span class="log-cost">${(r.tokens / 1000).toFixed(1)}k tok · $${r.cost.toFixed(2)}</span></li>`).join("");
    const filt = ["all", "NVDA", "SNDK", "MU"].map((f, i) => `<button class="filt-btn${i === 0 ? " active" : ""}">${f.toUpperCase()}</button>`).join("");
    return shell("activity", `<div class="screen">
      <div class="screen-hd"><div><h1 class="screen-title">ACTIVITY LOG</h1><p class="screen-sub">Everything the agents did — transparent and auditable. ${D.usage.runs} runs this month.</p></div></div>
      <div class="filt">${filt}</div>
      ${panel("", "", `<ul class="log">${rows}</ul>`, false)}
    </div>`);
  }

  window.SCREENS = { watchlist, company, review, timeline, settings, activity };
})();
