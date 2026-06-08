/* Agent Orange — mock data layer (the fixture from the prototype's data.js,
   ported to a typed module). This stands in for what the agentic backend in
   workers/ will return. Per §6, delete this and serve the same AOData shape
   from the API; the React Query layer (api.ts) is the only seam that changes. */
import type { AOData, Provenance } from './types'

// ---- Provenance snippets (where a number was found / corroborated) ----
const NVDA_NIPS_SNIPPET: Provenance = {
  source: '10-Q · Note 3 — Net Income Per Share',
  url: 'investor.nvidia.com/.../q1fy26-10q.pdf',
  page: 9,
  quote:
    'Net income per share: Basic (1) $2.40  $0.77 · Diluted (2) $2.39  $0.76. ' +
    '(1) Net income divided by basic weighted average shares. ' +
    '(2) Net income divided by diluted weighted average shares.',
}
const NVDA_IS_SNIPPET: Provenance = {
  source: '10-Q · Condensed Consolidated Statements of Income',
  url: 'investor.nvidia.com/.../q1fy26-10q.pdf',
  page: 5,
  quote:
    'Net income $58,321 · Net income per share — Diluted $2.39 · ' +
    'Diluted weighted average shares 24,391',
}
const NVDA_PR_SNIPPET: Provenance = {
  source: 'Press release — Q1 FY26 results',
  url: 'nvidianews.nvidia.com/.../q1-fiscal-2026',
  page: 1,
  quote:
    'Record first-quarter revenue of $93.2 billion, up 69% from a year ago. ' +
    'GAAP earnings per diluted share of $2.39, up 214% from a year ago.',
}

const SNDK_PR_SNIPPET: Provenance = {
  source: 'Press release — fiscal Q4 results',
  url: 'investors.sandisk.com/news/.../fy-q4',
  page: 1,
  quote: 'Revenue of $1.95 billion. GAAP net income of $0.82 per diluted share.',
}
const SNDK_TABLE_SNIPPET: Provenance = {
  source: '8-K Exhibit 99.1 — financial schedules',
  url: 'sec.gov/cgi-bin/browse-edgar?CIK=SNDK',
  page: 11,
  quote:
    'Diluted net income per share $0.79 — figure differs from press-release ' +
    'headline ($0.82) by $0.03; reconciliation references non-GAAP adjustments.',
}

export const AO_DATA: AOData = {
  // ---- Companies ----
  companies: [
    {
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      sector: 'Semiconductors',
      price: 182.4,
      dayChange: 2.12,
      currency: 'USD',
      cadence: 'Quarterly',
      fiscalNote: 'FY ends late Jan',
      status: 'validated',
      sourceMode: 'auto',
      sources: [
        { kind: 'IR', label: 'investor.nvidia.com', primary: true },
        { kind: 'SEC', label: 'EDGAR · CIK 0001045810' },
      ],
      latest: {
        period: 'Q1 FY26',
        periodEnd: 'Apr 26, 2026',
        reportedOn: 'May 27, 2026',
        validatedOn: 'May 27, 2026 · 02:14',
        metrics: [
          { key: 'Revenue', value: '$93.2B', raw: 93200, yoy: 69.0, conf: 'high', prov: [NVDA_PR_SNIPPET] },
          { key: 'Net income', value: '$58.32B', raw: 58321, yoy: 210.6, conf: 'high', prov: [NVDA_IS_SNIPPET] },
          { key: 'EPS · diluted', value: '$2.39', raw: 2.39, yoy: 214.5, conf: 'high', prov: [NVDA_NIPS_SNIPPET, NVDA_IS_SNIPPET, NVDA_PR_SNIPPET] },
          { key: 'EPS · basic', value: '$2.40', raw: 2.4, yoy: 211.7, conf: 'high', prov: [NVDA_NIPS_SNIPPET] },
          { key: 'Gross margin', value: '75.1%', raw: 75.1, yoy: 2.3, conf: 'med', prov: [NVDA_PR_SNIPPET] },
        ],
        validation: {
          passed: true,
          rule: 'Cross-reference EPS in ≥2 locations',
          detail:
            '“Net income per share” found on p.5 (income statement), p.9 (Note 3) ' +
            'and in the press release. Diluted EPS $2.39 agrees across all three.',
          corroborations: 3,
        },
      },
      sparkEps: [0.61, 0.68, 0.76, 0.81, 2.39],
      sparkLabels: ['Q1·25', 'Q2·25', 'Q3·25', 'Q4·25', 'Q1·26'],
      nextWindow: { from: 'Aug 18, 2026', to: 'Sep 02, 2026', label: 'Q2 FY26 expected' },
      history: [
        { period: 'Q1 FY26', end: 'Apr 26 ’26', rev: '$93.2B', ni: '$58.32B', epsD: '$2.39', epsB: '$2.40', gm: '75.1%', conf: 'high' },
        { period: 'Q4 FY25', end: 'Jan 25 ’26', rev: '$71.4B', ni: '$24.10B', epsD: '$0.81', epsB: '$0.82', gm: '73.0%', conf: 'high' },
        { period: 'Q3 FY25', end: 'Oct 27 ’25', rev: '$57.0B', ni: '$19.30B', epsD: '$0.76', epsB: '$0.78', gm: '74.6%', conf: 'high' },
        { period: 'Q2 FY25', end: 'Jul 28 ’25', rev: '$46.7B', ni: '$16.60B', epsD: '$0.68', epsB: '$0.69', gm: '75.1%', conf: 'high' },
        { period: 'Q1 FY25', end: 'Apr 28 ’25', rev: '$26.0B', ni: '$14.88B', epsD: '$0.61', epsB: '$0.62', gm: '78.4%', conf: 'high' },
      ],
    },
    {
      ticker: 'SNDK',
      name: 'SanDisk Corporation',
      sector: 'Storage / Flash memory',
      price: 51.2,
      dayChange: -1.34,
      currency: 'USD',
      cadence: 'Quarterly',
      fiscalNote: 'Spun off from WDC',
      status: 'review',
      sourceMode: 'guided',
      sources: [
        { kind: 'IR', label: 'investors.sandisk.com', primary: true },
        { kind: 'SEC', label: 'EDGAR · CIK 0002012896' },
      ],
      latest: {
        period: 'Fiscal Q4',
        periodEnd: 'Jun 27, 2026',
        reportedOn: 'Jul 30, 2026',
        validatedOn: null,
        metrics: [
          { key: 'Revenue', value: '$1.95B', raw: 1950, yoy: 11.4, conf: 'high', prov: [SNDK_PR_SNIPPET] },
          { key: 'Net income', value: '$118M', raw: 118, yoy: null, conf: 'med', prov: [SNDK_TABLE_SNIPPET] },
          { key: 'EPS · diluted', value: '$0.82?', raw: 0.82, yoy: null, conf: 'low', prov: [SNDK_PR_SNIPPET, SNDK_TABLE_SNIPPET] },
        ],
        validation: {
          passed: false,
          rule: 'Cross-reference EPS in ≥2 locations',
          detail:
            'Press release headline reports diluted EPS $0.82, but the 8-K financial ' +
            'schedule (p.11) shows $0.79. Difference attributed to non-GAAP adjustments ' +
            '— needs human decision on which figure to record.',
          corroborations: 2,
          conflict: true,
        },
      },
      sparkEps: [0.55, 0.61, 0.7, 0.74, 0.82],
      sparkLabels: ['Q4·25', 'Q1·26', 'Q2·26', 'Q3·26', 'Q4·26'],
      nextWindow: { from: 'Oct 28, 2026', to: 'Nov 12, 2026', label: 'Fiscal Q1 expected' },
      history: [
        { period: 'Fiscal Q4 ’26', end: 'Jun 27 ’26', rev: '$1.95B', ni: '$118M', epsD: '$0.82?', epsB: '$0.83?', gm: '31.2%', conf: 'low' },
        { period: 'Fiscal Q3 ’26', end: 'Mar 28 ’26', rev: '$1.87B', ni: '$104M', epsD: '$0.74', epsB: '$0.75', gm: '30.1%', conf: 'high' },
        { period: 'Fiscal Q2 ’26', end: 'Dec 27 ’25', rev: '$1.81B', ni: '$99M', epsD: '$0.70', epsB: '$0.71', gm: '29.4%', conf: 'high' },
        { period: 'Fiscal Q1 ’26', end: 'Sep 27 ’25', rev: '$1.74B', ni: '$86M', epsD: '$0.61', epsB: '$0.62', gm: '28.0%', conf: 'high' },
      ],
    },
    {
      ticker: 'MU',
      name: 'Micron Technology',
      sector: 'Memory / Storage semis',
      price: 134.8,
      dayChange: 0.58,
      currency: 'USD',
      cadence: 'Quarterly',
      fiscalNote: 'FY ends late Aug',
      status: 'watching',
      sourceMode: 'auto',
      sources: [
        { kind: 'IR', label: 'investors.micron.com', primary: true },
        { kind: 'SEC', label: 'EDGAR · CIK 0000723125' },
      ],
      latest: {
        period: 'Q3 FY26',
        periodEnd: 'May 28, 2026',
        reportedOn: 'Jun 25, 2026',
        validatedOn: 'Jun 25, 2026 · 16:40',
        metrics: [
          { key: 'Revenue', value: '$9.80B', raw: 9800, yoy: 31.2, conf: 'high', prov: [] },
          { key: 'Net income', value: '$2.10B', raw: 2100, yoy: 88.0, conf: 'high', prov: [] },
          { key: 'EPS · diluted', value: '$1.85', raw: 1.85, yoy: 92.7, conf: 'high', prov: [] },
        ],
        validation: {
          passed: true,
          rule: 'Cross-reference EPS in ≥2 locations',
          detail: 'Diluted EPS $1.85 agrees between income statement (p.6) and Note 4 (p.12).',
          corroborations: 2,
        },
      },
      sparkEps: [0.96, 1.18, 1.41, 1.61, 1.85],
      sparkLabels: ['Q3·25', 'Q4·25', 'Q1·26', 'Q2·26', 'Q3·26'],
      nextWindow: { from: 'Sep 22, 2026', to: 'Oct 06, 2026', label: 'Q4 FY26 — watching now' },
      history: [
        { period: 'Q3 FY26', end: 'May 28 ’26', rev: '$9.80B', ni: '$2.10B', epsD: '$1.85', epsB: '$1.87', gm: '39.5%', conf: 'high' },
        { period: 'Q2 FY26', end: 'Feb 27 ’26', rev: '$9.10B', ni: '$1.80B', epsD: '$1.61', epsB: '$1.63', gm: '38.2%', conf: 'high' },
        { period: 'Q1 FY26', end: 'Nov 28 ’25', rev: '$8.70B', ni: '$1.58B', epsD: '$1.41', epsB: '$1.43', gm: '37.0%', conf: 'high' },
        { period: 'Q4 FY25', end: 'Aug 28 ’25', rev: '$7.75B', ni: '$1.32B', epsD: '$1.18', epsB: '$1.20', gm: '35.3%', conf: 'high' },
      ],
    },
  ],

  // ---- Review queue (human-in-the-loop) ----
  reviewQueue: [
    {
      id: 'rv-001',
      ticker: 'SNDK',
      period: 'Fiscal Q4',
      periodEnd: 'Jun 27, 2026',
      reason: 'EPS conflict across sources',
      conf: 'low',
      foundOn: 'Jul 30, 2026 · 09:12',
      field: 'EPS · diluted',
      candidates: [
        { value: '$0.82', source: 'Press release headline', page: 1, weight: 'GAAP, headline' },
        { value: '$0.79', source: '8-K Exhibit 99.1 (p.11)', page: 11, weight: 'schedule, footnoted' },
      ],
      snippet: SNDK_TABLE_SNIPPET,
    },
    {
      id: 'rv-002',
      ticker: 'SNDK',
      period: 'Fiscal Q4',
      periodEnd: 'Jun 27, 2026',
      reason: 'Net income found in only one location',
      conf: 'med',
      foundOn: 'Jul 30, 2026 · 09:12',
      field: 'Net income',
      candidates: [{ value: '$118M', source: '8-K Exhibit 99.1 (p.11)', page: 11, weight: 'single source' }],
      snippet: SNDK_TABLE_SNIPPET,
    },
  ],

  // ---- Agent activity log ----
  activity: [
    { t: 'Jul 30 09:12:41', agent: 'SNDK', level: 'warn', tokens: 41200, cost: 0.62, msg: 'Extracted Q4 figures — EPS conflict ($0.82 vs $0.79). Routed to Review Queue.' },
    { t: 'Jul 30 09:11:58', agent: 'SNDK', level: 'ok', tokens: 88400, cost: 1.33, msg: 'New 8-K detected on investors.sandisk.com. Downloaded Exhibit 99.1 (14 pp).' },
    { t: 'Jul 30 06:00:02', agent: 'SNDK', level: 'info', tokens: 1800, cost: 0.03, msg: 'Scheduled poll — checking IR + EDGAR for fiscal Q4 release.' },
    { t: 'Jul 29 18:00:01', agent: 'MU', level: 'info', tokens: 1750, cost: 0.03, msg: 'Scheduled poll — no new filing. Next expected window Sep 22 – Oct 06.' },
    { t: 'May 27 02:14:09', agent: 'NVDA', level: 'ok', tokens: 52600, cost: 0.79, msg: 'Validation PASSED — diluted EPS $2.39 corroborated in 3 locations. Recorded Q1 FY26.' },
    { t: 'May 27 02:13:30', agent: 'NVDA', level: 'ok', tokens: 96100, cost: 1.44, msg: 'Parsed 10-Q (38 pp) + press release. Extracted 5 metrics.' },
    { t: 'May 27 02:12:11', agent: 'NVDA', level: 'info', tokens: 2100, cost: 0.03, msg: 'New 10-Q detected on investor.nvidia.com — triggered extraction run.' },
  ],

  // ---- Usage / cost ----
  usage: {
    monthTokens: 1.24, // millions
    monthCost: 18.6,
    budget: 50,
    runs: 42,
    byModel: [
      { model: 'Claude Opus 4', task: 'Extraction · Validation', share: 64, cost: 11.9 },
      { model: 'Claude Sonnet 4', task: 'Discovery · Monitoring polls', share: 36, cost: 6.7 },
    ],
  },

  // ---- Provider / model routing (decoupling story) ----
  providers: [
    {
      id: 'anthropic',
      name: 'Anthropic — Claude',
      status: 'active',
      auth: 'Connected via Claude subscription',
      models: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'],
    },
    { id: 'openai', name: 'OpenAI — GPT', status: 'planned', auth: 'Add API key', models: ['GPT-5', 'GPT-5 mini'] },
    { id: 'google', name: 'Google — Gemini', status: 'planned', auth: 'Add API key', models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash'] },
  ],

  routing: [
    { task: 'Source discovery', desc: "Find where a company's results live (IR site, EDGAR).", model: 'Claude Sonnet 4' },
    { task: 'Monitoring poll', desc: 'Cheap recurring check for a new filing.', model: 'Claude Haiku 4' },
    { task: 'Extraction', desc: 'Pull figures from filings & PDFs.', model: 'Claude Opus 4' },
    { task: 'Validation', desc: 'Cross-reference numbers across the document.', model: 'Claude Opus 4' },
  ],
}
