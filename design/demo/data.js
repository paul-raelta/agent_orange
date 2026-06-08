/* Agent Orange — demo dataset for the walkthrough video.
   Mirrors the production data contract (types.ts), trimmed to what the
   scripted scenes actually render. Three companies in three states:
   NVDA validated · SNDK needs review · MU watching. */
window.DEMO = (function () {
  // ---- provenance snippets ----
  const NVDA_NIPS = {
    source: "10-Q · Note 3 — Net Income Per Share",
    url: "investor.nvidia.com/.../q1fy26-10q.pdf",
    page: 9,
    quote:
      "Net income per share: Basic $2.40 · Diluted $2.39. Net income divided by " +
      "diluted weighted average shares of 24,391 million.",
  };
  const NVDA_IS = {
    source: "10-Q · Condensed Consolidated Statements of Income",
    url: "investor.nvidia.com/.../q1fy26-10q.pdf",
    page: 5,
    quote: "Net income $58,321 · Net income per share — Diluted $2.39 · Diluted shares 24,391.",
  };
  const NVDA_PR = {
    source: "Press release — Q1 FY26 results",
    url: "nvidianews.nvidia.com/.../q1-fiscal-2026",
    page: 1,
    quote:
      "Record first-quarter revenue of $93.2 billion, up 69% from a year ago. " +
      "GAAP earnings per diluted share of $2.39, up 214% from a year ago.",
  };
  const SNDK_TABLE = {
    source: "8-K Exhibit 99.1 — financial schedules",
    url: "sec.gov/cgi-bin/browse-edgar?CIK=SNDK",
    page: 11,
    quote:
      "Diluted net income per share $0.79 — differs from the press-release headline " +
      "($0.82) by $0.03; reconciliation references non-GAAP adjustments.",
  };

  const companies = {
    NVDA: {
      ticker: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors",
      price: 182.4, dayChange: 2.12, cadence: "Quarterly", fiscalNote: "FY ends late Jan",
      status: "validated", sourceMode: "auto",
      sources: [
        { kind: "IR", label: "investor.nvidia.com", primary: true },
        { kind: "SEC", label: "EDGAR · CIK 0001045810" },
      ],
      portfolio: { shares: 320, value: 58368, unrealized: 21472, unrealizedPct: 58.2 },
      narrative:
        "Record quarter: revenue $93.2B (+69% YoY) and diluted EPS $2.39 (+214%), both ahead of the " +
        "prior run-rate. Data-center demand is the driver; gross margin held at 75%. Your 320 shares " +
        "are up 58% on cost.",
      sparkEps: [0.61, 0.68, 0.76, 0.81, 2.39],
      validatedOn: "May 27, 2026 · 02:14",
      latest: {
        period: "Q1 FY26", periodEnd: "Apr 26, 2026",
        metrics: [
          { key: "Revenue", value: "$93.2B", yoy: 69.0, conf: "high", prov: [NVDA_PR] },
          { key: "Net income", value: "$58.32B", yoy: 210.6, conf: "high", prov: [NVDA_IS] },
          { key: "EPS · diluted", value: "$2.39", yoy: 214.5, conf: "high", prov: [NVDA_NIPS, NVDA_IS, NVDA_PR] },
          { key: "EPS · basic", value: "$2.40", yoy: 211.7, conf: "high", prov: [NVDA_NIPS] },
          { key: "Gross margin", value: "75.1%", yoy: 2.3, conf: "med", prov: [NVDA_PR] },
        ],
        validation: {
          passed: true, rule: "Cross-reference EPS in ≥2 locations", corroborations: 3,
          detail:
            "“Net income per share” found on p.5 (income statement), p.9 (Note 3) and in the press " +
            "release. Diluted EPS $2.39 agrees across all three.",
        },
      },
      history: [
        { period: "Q1 FY26", end: "Apr 26 ’26", rev: "$93.2B", ni: "$58.32B", epsD: "$2.39", epsB: "$2.40", gm: "75.1%", conf: "high" },
        { period: "Q4 FY25", end: "Jan 25 ’26", rev: "$71.4B", ni: "$24.10B", epsD: "$0.81", epsB: "$0.82", gm: "73.0%", conf: "high" },
        { period: "Q3 FY25", end: "Oct 27 ’25", rev: "$57.0B", ni: "$19.30B", epsD: "$0.76", epsB: "$0.78", gm: "74.6%", conf: "high" },
        { period: "Q2 FY25", end: "Jul 28 ’25", rev: "$46.7B", ni: "$16.60B", epsD: "$0.68", epsB: "$0.69", gm: "75.1%", conf: "high" },
        { period: "Q1 FY25", end: "Apr 28 ’25", rev: "$26.0B", ni: "$14.88B", epsD: "$0.61", epsB: "$0.62", gm: "78.4%", conf: "high" },
      ],
      news: [
        { ts: "May 28 07:40", source: "Reuters", headline: "Nvidia tops estimates as data-center revenue surges", summary: "Q1 revenue of $93.2B beat consensus; guidance raised for Q2." },
        { ts: "May 27 16:25", source: "CNBC", headline: "Nvidia shares jump after earnings beat", summary: "Stock up sharply in after-hours trading on record results." },
        { ts: "May 22 09:10", source: "Bloomberg", headline: "Analysts raise price targets ahead of print", summary: "Several desks lift targets citing AI demand." },
      ],
    },

    SNDK: {
      ticker: "SNDK", name: "SanDisk Corporation", sector: "Storage / Flash memory",
      price: 51.2, dayChange: -1.34, cadence: "Quarterly", fiscalNote: "Spun off from WDC",
      status: "review", sourceMode: "guided",
      sources: [
        { kind: "IR", label: "investors.sandisk.com", primary: true },
        { kind: "SEC", label: "EDGAR · CIK 0002012896" },
      ],
      portfolio: { shares: 500, value: 25600, unrealized: -2400, unrealizedPct: -8.6 },
      narrative: null,
      sparkEps: [0.55, 0.61, 0.7, 0.74, 0.82],
      validatedOn: null,
      latest: {
        period: "Fiscal Q4", periodEnd: "Jun 27, 2026",
        metrics: [
          { key: "Revenue", value: "$1.95B", yoy: 11.4, conf: "high", prov: [] },
          { key: "Net income", value: "$118M", yoy: null, conf: "med", prov: [SNDK_TABLE] },
          { key: "EPS · diluted", value: "$0.82?", yoy: null, conf: "low", prov: [SNDK_TABLE] },
        ],
        validation: {
          passed: false, rule: "Cross-reference EPS in ≥2 locations", corroborations: 2, conflict: true,
          detail:
            "Press release headline reports diluted EPS $0.82, but the 8-K financial schedule (p.11) " +
            "shows $0.79. Difference attributed to non-GAAP adjustments — needs a human decision on " +
            "which figure to record.",
        },
      },
      history: [
        { period: "Q4 ’26", end: "Jun 27 ’26", rev: "$1.95B", ni: "$118M", epsD: "$0.82?", epsB: "$0.83?", gm: "31.2%", conf: "low" },
        { period: "Q3 ’26", end: "Mar 28 ’26", rev: "$1.87B", ni: "$104M", epsD: "$0.74", epsB: "$0.75", gm: "30.1%", conf: "high" },
        { period: "Q2 ’26", end: "Dec 27 ’25", rev: "$1.81B", ni: "$99M", epsD: "$0.70", epsB: "$0.71", gm: "29.4%", conf: "high" },
        { period: "Q1 ’26", end: "Sep 27 ’25", rev: "$1.74B", ni: "$86M", epsD: "$0.61", epsB: "$0.62", gm: "28.0%", conf: "high" },
      ],
      news: [],
    },

    MU: {
      ticker: "MU", name: "Micron Technology", sector: "Memory / Storage semis",
      price: 134.8, dayChange: 0.58, cadence: "Quarterly", fiscalNote: "FY ends late Aug",
      status: "watching", sourceMode: "auto",
      sources: [
        { kind: "IR", label: "investors.micron.com", primary: true },
        { kind: "SEC", label: "EDGAR · CIK 0000723125" },
      ],
      portfolio: { shares: 0, value: 0, unrealized: 0, unrealizedPct: 0 },
      narrative: null,
      sparkEps: [0.96, 1.18, 1.41, 1.61, 1.85],
      validatedOn: "Jun 25, 2026 · 16:40",
      latest: {
        period: "Q3 FY26", periodEnd: "May 28, 2026",
        metrics: [
          { key: "Revenue", value: "$9.80B", yoy: 31.2, conf: "high", prov: [] },
          { key: "Net income", value: "$2.10B", yoy: 88.0, conf: "high", prov: [] },
          { key: "EPS · diluted", value: "$1.85", yoy: 92.7, conf: "high", prov: [] },
        ],
        validation: { passed: true, rule: "Cross-reference EPS in ≥2 locations", corroborations: 2,
          detail: "Diluted EPS $1.85 agrees between income statement (p.6) and Note 4 (p.12)." },
      },
      nextWindow: { from: "Sep 22, 2026", to: "Oct 06, 2026", label: "Q4 FY26 — watching now" },
      history: [],
      news: [],
    },
  };

  const reviewItem = {
    id: "rv-001", ticker: "SNDK", period: "Fiscal Q4", periodEnd: "Jun 27, 2026",
    reason: "diluted EPS reported differently in two sources", conf: "low",
    foundOn: "Jul 30, 2026 · 09:12", field: "EPS · diluted",
    candidates: [
      { value: "$0.82", source: "Press release headline", page: 1, weight: "GAAP, headline" },
      { value: "$0.79", source: "8-K Exhibit 99.1 (p.11)", page: 11, weight: "schedule, footnoted" },
    ],
    snippet: SNDK_TABLE,
  };

  const usage = {
    monthTokens: 1.24, monthCost: 18.6, budget: 50, runs: 42,
    byModel: [
      { model: "Claude Opus 4", task: "Extraction · Validation", share: 64, cost: 11.9 },
      { model: "Claude Sonnet 4", task: "Discovery · Monitoring", share: 36, cost: 6.7 },
    ],
  };
  const providers = [
    { id: "anthropic", name: "Anthropic — Claude", status: "active", auth: "Connected via Claude subscription", models: ["Opus 4", "Sonnet 4", "Haiku 4"] },
    { id: "openai", name: "OpenAI — GPT", status: "planned", auth: "Add API key", models: ["GPT-5", "GPT-5 mini"] },
    { id: "google", name: "Google — Gemini", status: "planned", auth: "Add API key", models: ["Gemini 2.5 Pro", "Flash"] },
  ];
  const routing = [
    { task: "Source discovery", desc: "Find where a company's results live (IR site, EDGAR).", model: "Claude Sonnet 4" },
    { task: "Monitoring poll", desc: "Cheap recurring check for a new filing.", model: "Claude Haiku 4" },
    { task: "Extraction", desc: "Pull figures from filings & PDFs.", model: "Claude Opus 4" },
    { task: "Validation", desc: "Cross-reference numbers across the document.", model: "Claude Opus 4" },
  ];

  const activity = [
    { t: "09:12:41", agent: "SNDK", level: "warn", tokens: 41200, cost: 0.62, msg: "Extracted Q4 figures — EPS conflict ($0.82 vs $0.79). Routed to Review Queue." },
    { t: "09:11:58", agent: "SNDK", level: "ok", tokens: 88400, cost: 1.33, msg: "New 8-K detected on investors.sandisk.com. Downloaded Exhibit 99.1 (14 pp)." },
    { t: "09:11:50", agent: "NVDA", level: "ok", tokens: 52600, cost: 0.79, msg: "Validation PASSED — diluted EPS $2.39 corroborated in 3 locations. Recorded Q1 FY26." },
    { t: "09:11:12", agent: "NVDA", level: "ok", tokens: 96100, cost: 1.44, msg: "Parsed 10-Q (38 pp) + press release. Extracted 5 metrics." },
    { t: "09:10:02", agent: "MU", level: "info", tokens: 1750, cost: 0.03, msg: "Scheduled poll — no new filing. Next window Sep 22 – Oct 06." },
  ];

  const portfolioTotals = { totalValue: 83968, totalCost: 64896, unrealized: 19072, unrealizedPct: 29.4 };

  return { companies, order: ["NVDA", "SNDK", "MU"], reviewItem, usage, providers, routing, activity, portfolioTotals };
})();
