/* Agent Orange — the data contract (§6 of the handoff README).
   The UI only ever talks to this shape; the workers/ API serves it verbatim so
   the fixture can be swapped for a real backend with zero component change. */

export type Conf = 'high' | 'med' | 'low'

export type Provenance = {
  source: string
  url: string
  page: number
  quote: string
}

export type Metric = {
  key: string
  value: string
  raw: number
  yoy: number | null
  conf: Conf
  prov: Provenance[]
}

export type Validation = {
  passed: boolean
  rule: string
  detail: string
  corroborations: number
  conflict?: boolean
}

export type Source = {
  kind: 'IR' | 'SEC'
  label: string
  primary?: boolean
}

export type HistoryRow = {
  period: string
  end: string
  rev: string
  ni: string
  epsD: string
  epsB: string
  gm: string
  conf: Conf
}

/* Portfolio (per-company): live-priced position math. */
export type Portfolio = {
  shares: number
  costBasis: number
  value: number
  unrealized: number
  unrealizedPct: number
}

/* Watchlist header strip total. */
export type PortfolioTotals = {
  totalValue: number
  totalCost: number
  unrealized: number
  unrealizedPct: number
}

export type NewsItem = {
  ts: string
  headline: string
  summary: string
  url: string
  source: string
}

export type InsiderTx = {
  ts: string
  insider: string
  role: string
  type: 'BUY' | 'SELL'
  shares: number
  price: number
  value: number
  url: string
}

export type NotificationPrefs = {
  email: string
  phone: string
  emailEnabled: boolean
  smsEnabled: boolean
  onValidated: boolean
  onReview: boolean
  onWatchingStarted: boolean
  onBudget80: boolean
}

export type Company = {
  ticker: string
  name: string
  sector: string
  price: number
  dayChange: number
  currency: string
  cadence: 'Quarterly' | 'Semi-annual'
  fiscalNote: string
  status: 'validated' | 'review' | 'watching' | 'error'
  sourceMode: 'auto' | 'guided' | 'advanced'
  sources: Source[]
  latest: {
    period: string
    periodEnd: string
    reportedOn: string
    validatedOn: string | null
    metrics: Metric[]
    validation: Validation
  }
  sparkEps: number[]
  sparkLabels: string[]
  nextWindow: { from: string; to: string; label: string }
  history: HistoryRow[]
  /* Always present — zero when no shares/cost are recorded. */
  portfolio: Portfolio
  /* AI "what's worth knowing" — present on deep-dive once validation passes. */
  narrative: string | null
  /* Populated on the deep-dive (GET /companies/:ticker); omitted by the list endpoint. */
  news?: NewsItem[] | null
  insider?: InsiderTx[] | null
}

export type ReviewItem = {
  id: string
  ticker: string
  period: string
  periodEnd: string
  reason: string
  conf: Conf
  foundOn: string
  field: string
  candidates: { value: string; source: string; page: number; weight: string }[]
  snippet: Provenance
}

export type ActivityRow = {
  t: string
  agent: string
  level: 'ok' | 'warn' | 'info'
  tokens: number
  cost: number
  msg: string
}

export type Usage = {
  monthTokens: number
  monthCost: number
  budget: number
  runs: number
  byModel: { model: string; task: string; share: number; cost: number }[]
}

export type Provider = {
  id: string
  name: string
  status: 'active' | 'planned'
  auth: string
  models: string[]
}

export type RoutingRule = { task: string; desc: string; model: string }

/* Financial data sources the agents fetch from. Built-ins are seeded per
   user (sec_edgar, finnhub_*, ir_fetcher); user-origin rows are added via the
   Settings panel and resolve to a generic HTTPS fetcher. */
export type DataSourceKind = 'filings' | 'quote' | 'news' | 'insider' | 'ir'
export type DataSourceStatus = 'active' | 'planned' | 'error'
export type DataSourceOrigin = 'builtin' | 'user'

export type DataSource = {
  id: string
  sourceId: string
  name: string
  kind: DataSourceKind
  origin: DataSourceOrigin
  status: DataSourceStatus
  enabled: boolean
  baseUrl: string | null
  authLabel: string
  authSecretRef: string | null
  lastOkAt: string | null
  lastError: string | null
}

export type AddDataSourceRequest = {
  name: string
  url: string
  kind: DataSourceKind
  note?: string
}

export type PatchDataSourceRequest = {
  enabled?: boolean
  baseUrl?: string
  name?: string
}

export type TestDataSourceResult = {
  ok: boolean
  status: number | null
  contentType: string
  preview: string
  error: string | null
}

export type SourceSuggestion = {
  id: string
  ticker: string | null
  url: string
  kind: string | null
  note: string
  status: 'submitted' | 'reviewing' | 'live' | 'rejected'
  submittedAt: string
  reviewedAt: string | null
}

export type CreateSourceSuggestionRequest = {
  url: string
  ticker?: string
  kind?: string
  note?: string
}

export type AOData = {
  companies: Company[]
  reviewQueue: ReviewItem[]
  activity: ActivityRow[]
  usage: Usage
  providers: Provider[]
  routing: RoutingRule[]
}

/* Discovery polling (POST /companies → GET /discovery/:jobId). */
export type DiscoveryResult = {
  ir: string
  sec: string
  cadence: string
  window: string
}

export type DiscoveryStatus = {
  phase: 'discovering' | 'found' | 'error'
  result?: DiscoveryResult | null
  error?: string | null
}

export type RunResponse = { jobId: string; lastSync: string }
