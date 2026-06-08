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

export type AOData = {
  companies: Company[]
  reviewQueue: ReviewItem[]
  activity: ActivityRow[]
  usage: Usage
  providers: Provider[]
  routing: RoutingRule[]
}
