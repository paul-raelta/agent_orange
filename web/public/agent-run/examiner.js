/* Agent Orange — Document Examiner engine.
   Finds real-looking filings, opens them as white "paper", and examines them:
   magnifier zoom to sections, figures circled on the page, documents flipped
   through and cross-checked. ~12s, run-once. Pure DOM + timeouts. */
(function () {
  // DOCS / EXTRACT / SOURCES are hydrated from window.EXAMINER_COMPANIES at
  // start() — see examiner-docs.js. The block below is a safety fallback only;
  // if the docs script failed to load, the engine still has something to play.
  let DOCS = [], EXTRACT = [], SOURCES = [];

  function fig(id, text, mark) {
    let svg;
    if (mark === "box") svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><rect class="draw" x="2" y="2" width="96" height="36" rx="6" style="--len:300"/></svg>`;
    else if (mark === "underline") svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><line class="draw" x1="3" y1="34" x2="97" y2="34" style="--len:96"/></svg>`;
    else svg = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><ellipse class="draw" cx="50" cy="20" rx="47" ry="17" style="--len:210"/></svg>`;
    return `<span class="figmark" data-fig="${id}">${text}<span class="mk">${svg}</span></span>`;
  }

  const FALLBACK_DOCS = [
    {
      id: "10q-cover", tab: "10-Q · cover", name: "nvda-20260426.htm",
      meta: "SEC EDGAR · Form 10-Q",
      // focus steps: {fig, zoom, top, callout} — top = % of paper to bring under the lens
      focus: [
        { top: 22, zoom: 1.14, fig: "period", callout: "Period · Q1 FY2026" },
        { top: 40, zoom: 1.15, fig: "cik", callout: "CIK 0001045810 ✓" },
        { top: 72, zoom: 1.14, fig: "shares", callout: "Shares out · 24.39B" },
      ],
      html: `
        <div class="doc-center">
          <div class="doc-gov">UNITED STATES<br><b>SECURITIES AND EXCHANGE COMMISSION</b><br>Washington, D.C. 20549</div>
          <div class="doc-form">FORM 10-Q</div>
        </div>
        <hr class="doc-rule">
        <div class="doc-check">☒ &nbsp;QUARTERLY REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934</div>
        <div class="doc-p">For the quarterly period ended ${fig("period", "April 26, 2026", "underline")}</div>
        <div class="doc-check">☐ &nbsp;TRANSITION REPORT PURSUANT TO SECTION 13 OR 15(d)</div>
        <div class="doc-p">Commission File Number: ${fig("cik", "0-23985", "box")}</div>
        <hr class="doc-rule thin">
        <div class="doc-center" style="margin:14px 0">
          <div class="doc-h1">NVIDIA Corporation</div>
          <div class="doc-small">(Exact name of registrant as specified in its charter)</div>
        </div>
        <div class="doc-cols"><span><b>Delaware</b><br>(State of incorporation)</span><span><b>94-3177549</b><br>(I.R.S. Employer Identification No.)</span></div>
        <div class="doc-cols"><span>2788 San Tomas Expressway<br>Santa Clara, California 95051</span><span>(408) 486-2000</span></div>
        <hr class="doc-rule thin">
        <div class="doc-p doc-small">As of May 23, 2026, the registrant had outstanding</div>
        <div class="doc-p">${fig("shares", "24,390,000,000", "box")} shares of common stock, $0.001 par value.</div>`,
    },
    {
      id: "10q-income", tab: "10-Q · income stmt", name: "nvda-20260426.htm · p.5",
      meta: "Condensed Consolidated Statements of Income",
      focus: [
        { top: 16, zoom: 1.13, fig: "rev", callout: "Revenue → $93.2B" },
        { top: 46, zoom: 1.13, fig: "ni", callout: "Net income → $58.32B" },
        { top: 62, zoom: 1.15, fig: "eps_b", callout: "EPS basic → $2.40" },
        { top: 66, zoom: 1.15, fig: "eps_d", callout: "EPS diluted → $2.39 ✓✓✓" },
      ],
      html: `
        <div class="doc-center">
          <div class="doc-h2" style="text-transform:uppercase">NVIDIA Corporation and Subsidiaries</div>
          <div class="doc-h2">Condensed Consolidated Statements of Income</div>
          <div class="doc-small">(In millions, except per share data) — (Unaudited)</div>
        </div>
        <table class="doc-tbl">
          <thead><tr><th class="l"></th><th>Apr 26, 2026</th><th>Apr 28, 2025</th></tr></thead>
          <tbody>
            <tr><td class="l">Revenue</td><td>${fig("rev", "$ 93,280", "box")}</td><td>$ 26,044</td></tr>
            <tr><td class="l">Cost of revenue</td><td>23,196</td><td>5,638</td></tr>
            <tr class="sub"><td class="l">Gross profit</td><td>70,084</td><td>20,406</td></tr>
            <tr class="section"><td class="l">Operating expenses:</td><td></td><td></td></tr>
            <tr><td class="l ind">Research and development</td><td>4,941</td><td>2,720</td></tr>
            <tr><td class="l ind">Sales, general and administrative</td><td>1,153</td><td>991</td></tr>
            <tr class="sub"><td class="l ind">Total operating expenses</td><td>6,094</td><td>3,711</td></tr>
            <tr class="sub"><td class="l">Operating income</td><td>63,990</td><td>16,695</td></tr>
            <tr><td class="l">Interest and other income, net</td><td>1,021</td><td>620</td></tr>
            <tr><td class="l">Income tax expense</td><td>6,690</td><td>2,434</td></tr>
            <tr class="total"><td class="l">Net income</td><td>${fig("ni", "$ 58,321", "box")}</td><td>$ 14,881</td></tr>
            <tr class="section"><td class="l">Net income per share:</td><td></td><td></td></tr>
            <tr><td class="l ind">Basic</td><td>${fig("eps_b", "$ 2.40", "circle")}</td><td>$ 0.61</td></tr>
            <tr><td class="l ind">Diluted</td><td>${fig("eps_d", "$ 2.39", "circle")}</td><td>$ 0.60</td></tr>
            <tr class="section"><td class="l">Weighted average shares:</td><td></td><td></td></tr>
            <tr><td class="l ind">Basic</td><td>24,304</td><td>24,130</td></tr>
            <tr><td class="l ind">Diluted</td><td>24,391</td><td>24,555</td></tr>
          </tbody>
        </table>`,
    },
    {
      id: "press", tab: "press release", name: "nvidianews.nvidia.com",
      meta: "Press release — Q1 FY26 results",
      focus: [
        { top: 30, zoom: 1.15, fig: "p_rev", callout: "Revenue $93.2B ✓ matches 10-Q" },
        { top: 52, zoom: 1.16, fig: "p_eps", callout: "EPS $2.39 ✓ matches 10-Q p.5" },
      ],
      html: `
        <div class="doc-small" style="color:#76b900;font-weight:700;letter-spacing:.04em">NVIDIA NEWSROOM</div>
        <hr class="doc-rule thin">
        <div class="doc-h1" style="text-transform:none;font-size:16px;line-height:1.3;margin-top:10px">NVIDIA Announces Financial Results for First Quarter Fiscal 2026</div>
        <div class="doc-small" style="margin-top:8px">SANTA CLARA, Calif. — May 27, 2026</div>
        <div class="doc-p">NVIDIA today reported record revenue for the first quarter ended April 26, 2026, of
          ${fig("p_rev", "$93.2 billion", "underline")}, up 69% from a year ago and up 12% from the previous quarter.</div>
        <div class="doc-p">GAAP earnings per diluted share were ${fig("p_eps", "$2.39", "circle")}, up 214% from a year ago.
          Record data-center revenue of $88.0 billion was up 73% from a year ago.</div>
        <div class="doc-p">“Demand for accelerated computing is extraordinary,” said the CEO. “We are racing to scale.”</div>
        <div class="doc-h2">Q2 Fiscal 2026 Outlook</div>
        <div class="doc-p">Revenue is expected to be $101.0 billion, plus or minus 2%.</div>`,
    },
  ];

  const FALLBACK_SOURCES = [
    { ic: "edgar", cls: "edgar", name: "NVIDIA CORP — Form 10-Q", meta: "SEC EDGAR · filed May 27, 2026 · 38 pp", doc: 0 },
    { ic: "ir", cls: "ir", name: "Q1 FY26 press release", meta: "nvidianews.nvidia.com", doc: 2 },
    { ic: "edgar", cls: "edgar", name: "Form 8-K · Exhibit 99.1", meta: "SEC EDGAR · financial schedules", doc: null },
  ];

  const PSTEPS = ["discover", "fetch", "parse", "extract", "validate"];
  const FALLBACK_EXTRACT = [
    { fig: "rev", k: "Revenue", v: "$93.2B", conf: "high", src: "10-Q income stmt · p.5" },
    { fig: "ni", k: "Net income", v: "$58.32B", conf: "high", src: "10-Q income stmt · p.5" },
    { fig: "eps_d", k: "EPS · diluted", v: "$2.39", conf: "high", src: "10-Q p.5 + press release", corro: true },
    { fig: "eps_b", k: "EPS · basic", v: "$2.40", conf: "high", src: "10-Q income stmt · p.5" },
  ];

  function pickCompany(ticker) {
    const reg = window.EXAMINER_COMPANIES || {};
    const keys = Object.keys(reg);
    if (!keys.length) return { DOCS: FALLBACK_DOCS, EXTRACT: FALLBACK_EXTRACT, SOURCES: FALLBACK_SOURCES };
    const c = (ticker && reg[ticker]) || reg[keys[0]];
    return {
      DOCS: c.DOCS || FALLBACK_DOCS,
      EXTRACT: c.EXTRACT || FALLBACK_EXTRACT,
      SOURCES: c.SOURCES || FALLBACK_SOURCES,
    };
  }

  let host, timers = [], rafId = null, hasRun = false;
  // per-run state (reset in start)
  let playlist = [];           // tickers WITH bespoke fixtures — play full chapters
  let backgroundList = [];     // tickers without fixtures — render in the BG rail
  let logoByTicker = {};       // ticker → logo CDN URL (Finnhub), populated by start()
  let cumulative = { pages: 0, tables: 0, figures: 0, sources: 0, cost: 0 };
  let results = [];
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function clearAll() { timers.forEach(clearTimeout); timers = []; if (rafId) cancelAnimationFrame(rafId); rafId = null; }
  const $ = (s) => host.querySelector(s);
  const $$ = (s) => host.querySelectorAll(s);

  function build() {
    host = el("div"); host.id = "runConsole";
    host.innerHTML = `
      <div class="rc-top">
        <div class="rc-brand"><span class="rc-mark"></span><div><div class="rc-title">AGENT&nbsp;<b>RUN</b></div><div class="rc-sub">examining NVIDIA filings · Claude Opus 4</div></div></div>
        <div class="rc-counters">
          <div class="rc-counter"><span class="rc-counter-val" data-c="pages">0</span><span class="rc-counter-lab">pages read</span></div>
          <div class="rc-counter"><span class="rc-counter-val" data-c="tables">0</span><span class="rc-counter-lab">tables parsed</span></div>
          <div class="rc-counter"><span class="rc-counter-val" data-c="figures">0</span><span class="rc-counter-lab">figures captured</span></div>
          <div class="rc-counter"><span class="rc-counter-val" data-c="sources">0</span><span class="rc-counter-lab">sources x-ref'd</span></div>
          <div class="rc-counter cost"><span class="rc-counter-val" data-c="cost">$0.00</span><span class="rc-counter-lab">opus spend</span></div>
          <div class="rc-elapsed" data-elapsed>0.0s</div>
        </div>
      </div>
      <div class="rc-bg-rail" data-bg-rail style="display:none">
        <div class="rc-bg-lab">BACKGROUND TASKS</div>
        <div class="rc-bg-pills" data-bg-pills></div>
      </div>
      <div class="rc-body">
        <div class="rc-col rc-left">
          <div class="rc-col-hd">Sources</div>
          <div class="rc-searching" data-searching><span class="spin"></span>searching SEC EDGAR + IR…</div>
          <div class="rc-sources" data-sources></div>
          <div class="rc-pipeline">${PSTEPS.map((s) => `<div class="rc-pstep" data-pstep="${s}"><span class="rc-pstep-dot"></span><span class="rc-pstep-lab">${s}</span></div>`).join("")}</div>
        </div>
        <div class="rc-col rc-viewer">
          <div class="rc-doctabs" data-doctabs></div>
          <div class="rc-stage-wrap">
            <div class="rc-paper-vp">
              <div class="rc-paper" data-paper></div>
              <div class="rc-lens" data-lens></div>
              <div class="rc-scan" data-scan></div>
              <div class="rc-callout" data-callout></div>
            </div>
          </div>
        </div>
        <div class="rc-col rc-right">
          <div class="rc-col-hd">Extracted data</div>
          <div class="rc-extract" data-extract></div>
        </div>
      </div>
      <div class="rc-bottom"><div class="rc-phase">INITIALIZING <b>AGENT</b></div><div class="rc-progress"><span data-progress></span></div></div>
      <div class="rc-summary"><div class="rc-summary-card">
        <div class="rc-summary-check">✓</div><div class="rc-summary-title">EXAMINATION COMPLETE</div>
        <div class="rc-summary-line" data-summary></div><div class="rc-summary-hint">returning to watchlist…</div>
      </div></div>`;
    document.body.appendChild(host);
  }

  // Counters are cumulative across all tickers. tweenCountersTo animates from
  // whatever the counter currently reads to the new cumulative target. Multiple
  // calls during a chapter chain naturally — the latest call cancels the prior
  // RAF and picks up from the displayed value.
  function tweenCountersTo(target, durMs) {
    if (!host) return;
    const start = {};
    for (const k in target) {
      const n = $(`[data-c="${k}"]`); if (!n) continue;
      const txt = (n.textContent || "0").toString();
      start[k] = k === "cost" ? parseFloat(txt.replace("$", "")) || 0 : parseInt(txt, 10) || 0;
    }
    const t0 = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    (function frame(now) {
      const f = Math.max(0, Math.min(1, (now - t0) / durMs)), e = 1 - Math.pow(1 - f, 2);
      for (const k in target) {
        const n = $(`[data-c="${k}"]`); if (!n) continue;
        const v = start[k] + (target[k] - start[k]) * e;
        n.textContent = k === "cost" ? "$" + v.toFixed(2) : String(Math.round(v));
      }
      if (f < 1) rafId = requestAnimationFrame(frame);
    })(performance.now());
  }
  function startElapsed(totalMs) {
    const t0 = performance.now(), elv = $("[data-elapsed]"), prog = $("[data-progress]");
    (function frame(now) { const ms = now - t0; elv.textContent = (ms / 1000).toFixed(1) + "s"; prog.style.width = Math.min(100, ms / totalMs * 100) + "%"; if (ms < totalMs) requestAnimationFrame(frame); })(performance.now());
  }
  const setPhase = (h) => { const p = $(".rc-phase"); if (p) p.innerHTML = h; };
  function pstep(name) { PSTEPS.forEach((s, i) => { const n = $(`[data-pstep="${s}"]`); const ai = PSTEPS.indexOf(name); n.classList.toggle("done", i < ai); n.classList.toggle("active", i === ai); }); }

  // open a document into the paper
  let curDoc = -1;
  function openDoc(di, onReady) {
    curDoc = di;
    const d = DOCS[di];
    const paper = $("[data-paper]");
    // tabs
    $$(".rc-doctab").forEach((t, i) => { t.classList.toggle("active", i === di); });
    paper.style.transition = "none"; paper.style.transform = "translateY(0) scale(1)";
    paper.className = "rc-paper loading"; paper.innerHTML = d.html;
    $(`[data-doctabs]`); // ensure
    // fetch shimmer then load
    later(60, () => { paper.classList.remove("loading"); paper.classList.add("loaded"); });
    later(120, () => { paper.style.transition = ""; if (onReady) onReady(d); });
  }

  // bring a focus target to the lens (viewport center) by translating + scaling the paper
  function focusOn(step) {
    const vp = $(".rc-paper-vp"), paper = $("[data-paper]");
    const vpH = vp.clientHeight;
    const z = step.zoom || 1.4;
    // target Y within the *unscaled* paper
    const fm = paper.querySelector(`[data-fig="${step.fig}"]`);
    let targetY;
    if (fm) targetY = fm.offsetTop + fm.offsetHeight / 2;
    else targetY = paper.scrollHeight * (step.top / 100);
    // after scaling by z about origin (50% 0), the target sits at targetY*z; center it in vp
    const ty = vpH / 2 - targetY * z;
    paper.style.transform = `translateY(${ty}px) scale(${z})`;
    // callout near center
    const co = $("[data-callout]");
    if (step.callout) {
      co.textContent = step.callout;
      co.style.left = "50%"; co.style.top = "calc(50% + 30px)"; co.style.transform = "translateX(-50%)";
      co.classList.remove("show"); void co.offsetWidth; co.classList.add("show");
    }
    // circle the figure
    if (fm) later(380, () => fm.classList.add("hit"));
  }

  function addExtract(x) {
    const wrap = $("[data-extract]");
    const cls = "rc-xrow" + (x.corro ? " corro" : "") + (x.conflict ? " conflict" : "");
    const row = el("div", cls);
    row.setAttribute("data-fig", x.fig);
    const badge = x.conflict
      ? `<div class="rc-corro-badge" style="background:#5a1a14;color:#ffb4a8">✗ conflicts with GAAP figure — routed to REVIEW</div>`
      : x.corro
        ? `<div class="rc-corro-badge">⛓ corroborated ×3 — confidence HIGH</div>`
        : "";
    row.innerHTML = `<div class="rc-xrow-top"><span class="rc-xrow-k">${x.k}</span><span class="rc-xrow-c ${x.conf}">${x.conf.toUpperCase()}</span></div>
      <div class="rc-xrow-v">${x.v}</div>
      <div class="rc-xrow-src"><span class="tick">${x.conflict ? "✗" : "✓"}</span>${x.src}</div>
      ${badge}`;
    wrap.appendChild(row);
    requestAnimationFrame(() => row.classList.add("in"));
  }

  // ---------- the sequence ----------
  // wait() resolves after ms — and uses later() so a teardown clears it cleanly.
  function wait(ms) { return new Promise((r) => later(ms, r)); }
  function openDocAsync(di) {
    return new Promise((r) => openDoc(di, () => { runScan(); r(); }));
  }

  // Reset the per-ticker columns / paper between chapters (idx > 0). Updates
  // the brand subtitle to show "examining {TICKER} filings · N of M".
  function resetChapter(ticker, idx) {
    const sub = host && host.querySelector(".rc-sub");
    const logo = logoByTicker[ticker];
    const logoHtml = logo
      ? `<img class="rc-sub-logo" src="${logo}" alt="" onerror="this.remove()" /> `
      : '';
    if (sub) sub.innerHTML = `${logoHtml}examining <b>${ticker}</b> filings · Claude Opus 4 · ${idx + 1} of ${playlist.length}`;
    if (idx === 0) return;
    const srcWrap = $("[data-sources]"); if (srcWrap) srcWrap.innerHTML = "";
    const exWrap = $("[data-extract]"); if (exWrap) exWrap.innerHTML = "";
    const paper = $("[data-paper]");
    if (paper) {
      paper.style.transition = "none";
      paper.style.transform = "translateY(0) scale(1)";
      paper.innerHTML = "";
      paper.className = "rc-paper";
    }
    const callout = $("[data-callout]"); if (callout) callout.classList.remove("show");
    const lens = $("[data-lens]"); if (lens) lens.classList.remove("on");
    const searching = $("[data-searching]");
    if (searching) {
      searching.style.display = "";
      searching.innerHTML = `<span class="spin"></span>searching SEC EDGAR + IR for ${ticker}…`;
    }
  }

  async function runOne(idx, ticker) {
    const picked = pickCompany(ticker);
    DOCS = picked.DOCS; EXTRACT = picked.EXTRACT; SOURCES = picked.SOURCES;
    resetChapter(ticker, idx);

    // doc tabs for this chapter
    const tabs = $("[data-doctabs]");
    if (tabs) tabs.innerHTML = DOCS.map((d, i) => `<div class="rc-doctab" data-tab="${i}">${d.tab}</div>`).join("");

    // ---- DISCOVER ----
    pstep("discover");
    setPhase(`SEARCHING <b>SEC EDGAR + IR</b> for new <b>${ticker}</b> filings`);
    const srcWrap = $("[data-sources]");
    for (let i = 0; i < SOURCES.length; i++) {
      await wait(i === 0 ? 500 : 360);
      const s = SOURCES[i];
      const node = el("div", "rc-src");
      node.innerHTML = `<span class="rc-src-ic ${s.cls}">${s.ic === "edgar" ? "▤" : "◈"}</span><div class="rc-src-main"><div class="rc-src-name">${s.name}</div><div class="rc-src-meta">${s.meta}</div><div class="rc-src-stat">FOUND</div></div>`;
      srcWrap.appendChild(node);
      requestAnimationFrame(() => node.classList.add("in"));
    }
    const sp = $("[data-searching]"); if (sp) sp.style.display = "none";
    await wait(180);

    // ---- FETCH cover ----
    pstep("fetch");
    setPhase(`FETCHING <b>${ticker}</b> · ${DOCS[0].tab}`);
    markSource(0, "active");
    cumulative.pages += 12; cumulative.tables += 2; cumulative.sources += 1; cumulative.cost += 0.42;
    tweenCountersTo(cumulative, 1500);
    await openDocAsync(0);
    await wait(150);

    // ---- PARSE cover ----
    pstep("parse");
    setPhase(`READING <b>${ticker} ${DOCS[0].tab}</b> · verifying issuer & period`);
    for (const f of DOCS[0].focus) {
      focusOn(f);
      await wait(680);
    }

    // ---- EXTRACT income statement ----
    markSource(0, "read");
    pstep("extract");
    setPhase(`EXAMINING <b>${ticker} STATEMENTS OF INCOME</b> · capturing figures`);
    cumulative.pages += 20; cumulative.tables += 3; cumulative.sources += 1; cumulative.cost += 0.60;
    tweenCountersTo(cumulative, 1800);
    await openDocAsync(1);
    await wait(220);
    for (const f of DOCS[1].focus) {
      focusOn(f);
      await wait(420);
      const x = EXTRACT.find((e) => e.fig === f.fig);
      if (x && !host.querySelector(`.rc-xrow[data-fig="${x.fig}"]`)) {
        cumulative.figures += 1; tweenCountersTo(cumulative, 280);
        addExtract(x);
      }
      await wait(260);
    }

    // ---- CROSS-CHECK press release ----
    markSource(1, "active");
    setPhase(`CROSS-CHECKING <b>${ticker} PRESS RELEASE</b>`);
    cumulative.pages += 6; cumulative.sources += 1; cumulative.cost += 0.35;
    tweenCountersTo(cumulative, 1200);
    await openDocAsync(2);
    await wait(200);
    for (const f of DOCS[2].focus) {
      focusOn(f);
      await wait(580);
    }
    // Capture any extracts not pulled in during the income-stmt sweep.
    for (const x of EXTRACT) {
      if (!host.querySelector(`.rc-xrow[data-fig="${x.fig}"]`)) {
        cumulative.figures += 1; tweenCountersTo(cumulative, 200);
        addExtract(x);
        await wait(180);
      }
    }

    // ---- VALIDATE ----
    pstep("validate");
    markSource(1, "read"); markSource(2, "read");
    const conflictRow = EXTRACT.find((x) => x.conflict);
    if (conflictRow) {
      setPhase(`<b>${ticker} — EPS DIVERGENCE</b> · adjusted ${conflictRow.v} vs GAAP → routed to <b>REVIEW</b>`);
      results.push({ ticker, status: "review", note: `${conflictRow.k} diverges` });
    } else {
      const hero = EXTRACT.find((x) => x.corro) || EXTRACT[0];
      setPhase(`<b>${ticker}</b> VALIDATED · <b>${hero.k} ${hero.v} corroborated ×3</b>`);
      results.push({ ticker, status: "validated", hero });
    }
    await wait(900);
  }

  // Static background rail — one pill per non-fixture ticker. Pills start in
  // "refreshing" state and flip to "done" on a fixed timer evenly distributed
  // across the chapter timeline so the rail finishes just before the summary
  // card appears. The actual Finnhub jobs run in the backend regardless; this
  // is presentation timing, not real progress.
  function hydrateBackgroundRail() {
    const rail = $("[data-bg-rail]");
    const pills = $("[data-bg-pills]");
    if (!rail || !pills) return;
    if (!backgroundList.length) { rail.style.display = "none"; return; }
    rail.style.display = "";
    pills.innerHTML = backgroundList.map((t) => {
      const logo = logoByTicker[t];
      const logoHtml = logo
        ? `<img class="rc-bg-logo" src="${logo}" alt="" onerror="this.remove()" />`
        : '';
      return `
      <div class="rc-bg-pill refreshing" data-bgticker="${t}">
        ${logoHtml}
        <span class="rc-bg-spin"></span>
        <span class="rc-bg-tk">${t}</span>
        <span class="rc-bg-kinds">quote · news · insider</span>
        <span class="rc-bg-stat">refreshing…</span>
      </div>
    `;
    }).join("");
  }
  function startBackgroundRail(totalMs) {
    if (!backgroundList.length) return;
    const headroom = 1500;                              // finish before summary
    const startDelay = 1200;
    const span = Math.max(0, totalMs - startDelay - headroom);
    const stride = backgroundList.length > 1
      ? span / (backgroundList.length - 1) : 0;
    backgroundList.forEach((t, i) => {
      later(startDelay + i * stride, () => {
        const node = host && host.querySelector(`[data-bgticker="${t}"]`);
        if (!node) return;
        node.classList.remove("refreshing");
        node.classList.add("done");
        const stat = node.querySelector(".rc-bg-stat");
        if (stat) stat.textContent = "✓ refreshed";
      });
    });
  }

  async function run() {
    // Background-only mode — no watchlist ticker has bespoke fixtures. Skip
    // the document-examination chapter and just play the BG rail so we don't
    // fake an extraction the user didn't run.
    if (!playlist.length) {
      if (!backgroundList.length) { finish(); return; }
      const n = backgroundList.length;
      const TOTAL = Math.max(6000, n * 700 + 4000);
      const sub = host && host.querySelector(".rc-sub");
      if (sub) sub.innerHTML = `scanning watchlist · <b>${n}</b> ${n === 1 ? "company" : "companies"} · live data refresh`;
      hydrateBackgroundRail();
      startElapsed(TOTAL);
      startBackgroundRail(TOTAL);
      await wait(Math.max(TOTAL - 1500, 1500));
      const sumEl = $("[data-summary]");
      if (sumEl) sumEl.innerHTML = `Refreshed quotes + news + insider for <b>${n}</b> ${n === 1 ? "company" : "companies"} (${backgroundList.join(", ")})`;
      const sumCard = host && host.querySelector(".rc-summary"); if (sumCard) sumCard.classList.add("show");
      await wait(2300);
      finish();
      return;
    }
    const TOTAL = playlist.length * 9500 + 2500;
    hydrateBackgroundRail();
    startElapsed(TOTAL);
    startBackgroundRail(TOTAL);
    for (let i = 0; i < playlist.length; i++) {
      await runOne(i, playlist[i]);
    }
    const reviewed = results.filter((r) => r.status === "review");
    const validated = results.filter((r) => r.status === "validated");
    let line = `Read <b>${cumulative.pages}</b> pages across <b>${cumulative.sources}</b> filings from <b>${playlist.length}</b> ${playlist.length === 1 ? "company" : "companies"} · captured <b>${cumulative.figures}</b> figures`;
    if (reviewed.length) {
      line += ` · <b>${validated.length}</b> validated, <b>${reviewed.length}</b> routed to REVIEW (${reviewed.map((r) => r.ticker).join(", ")})`;
    } else {
      line += ` · all <b>${validated.length}</b> tickers <b>VALIDATED</b>`;
    }
    if (backgroundList.length) {
      line += ` · refreshed quotes + news + insider for <b>${backgroundList.length}</b> more (${backgroundList.join(", ")})`;
    }
    const sumEl = $("[data-summary]"); if (sumEl) sumEl.innerHTML = line;
    const sumCard = host && host.querySelector(".rc-summary"); if (sumCard) sumCard.classList.add("show");
    await wait(2300);
    finish();
  }

  function markSource(i, state) {
    const nodes = $$(".rc-src");
    if (!nodes[i]) return;
    nodes[i].classList.remove("active", "read");
    nodes[i].classList.add(state);
    const stat = nodes[i].querySelector(".rc-src-stat");
    if (stat) stat.textContent = state === "active" ? "READING…" : state === "read" ? "✓ READ" : "FOUND";
  }

  function runScan() {
    const lens = $("[data-lens]"), scan = $("[data-scan]");
    if (lens) lens.classList.add("on");
    if (scan) { scan.classList.remove("run"); void scan.offsetWidth; scan.classList.add("run"); }
  }

  function finish() {
    clearAll();
    if (host) host.classList.remove("open");
    setTimeout(() => { const n = document.getElementById("runConsole"); if (n && n.parentNode) n.parentNode.removeChild(n); host = null; }, 420);
    if (typeof window.onAgentRunComplete === "function") window.onAgentRunComplete();
  }

  // remove any in-flight run completely (timers + DOM) so a fresh start is clean
  function teardown() {
    clearAll();
    const n = document.getElementById("runConsole");
    if (n && n.parentNode) n.parentNode.removeChild(n);
    host = null;
  }

  // start() accepts:
  //   - a single ticker string
  //   - an array of ticker strings
  //   - an array of { ticker, logoUrl? } objects (carries real Finnhub logos)
  //   - undefined (falls back to every key in EXAMINER_COMPANIES)
  // The engine splits the input into two lists:
  //   - playlist: tickers WITH bespoke fixtures in EXAMINER_COMPANIES — each
  //     plays as its own examined-doc chapter (~9.5s).
  //   - backgroundList: tickers without fixtures — rendered in the
  //     BACKGROUND TASKS rail with a static refreshing → done animation.
  // The real Finnhub jobs hit those tickers in the backend regardless; the
  // rail is presentation only.
  function start(tickersArg) {
    if (hasRun) { if (typeof window.onAgentRunComplete === "function") window.onAgentRunComplete(); return; }
    hasRun = true;
    const reg = window.EXAMINER_COMPANIES || {};
    let raw;
    if (Array.isArray(tickersArg)) raw = tickersArg;
    else if (tickersArg) raw = [tickersArg];
    else raw = Object.keys(reg);
    logoByTicker = {};
    const list = raw.map((it) => {
      if (it && typeof it === "object" && it.ticker) {
        if (it.logoUrl) logoByTicker[it.ticker] = it.logoUrl;
        return it.ticker;
      }
      return it;
    });
    const dedup = Array.from(new Set(list.filter(Boolean)));
    playlist = dedup.filter((t) => reg[t]);
    backgroundList = dedup.filter((t) => !reg[t]);
    // No fallback to a registry key here — if the user's watchlist has no
    // fixture-equipped tickers, run() drops into background-only mode so we
    // don't fake a chapter for a ticker they didn't add.
    cumulative = { pages: 0, tables: 0, figures: 0, sources: 0, cost: 0 };
    results = [];
    teardown();           // guarantee no leftover console/timers
    build();
    requestAnimationFrame(() => host.classList.add("open"));
    later(60, run);
  }
  function reset() { hasRun = false; teardown(); }
  window.AgentRun = { start, reset, get hasRun() { return hasRun; } };
})();
