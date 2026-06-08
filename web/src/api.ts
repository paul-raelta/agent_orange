/* Agent Orange — data layer seam (§6).
   THE one file that knows where data comes from. Hits the workers/ REST API.
   Hooks in hooks.ts are the only consumers; components don't know this exists.

   VITE_API_BASE controls the base URL — defaults to local dev. The dev Procfile
   sets it explicitly. */
import type {
  ActivityRow,
  Company,
  DiscoveryStatus,
  NewsItem,
  InsiderTx,
  NotificationPrefs,
  PortfolioTotals,
  Provider,
  ReviewItem,
  RoutingRule,
  RunResponse,
  Usage,
} from './types'

// Default to the same hostname the UI was loaded from so LAN access works:
// open http://<your-mac-ip>:5173 from your phone and the UI hits the API at
// http://<your-mac-ip>:8000. Override with VITE_API_BASE for any other setup.
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

/* --- fetch helpers ------------------------------------------------------ */

async function get<T>(path: string): Promise<T> {
  const r = await fetch(API_BASE + path, { credentials: 'omit' })
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status} ${r.statusText}`)
  return r.json() as Promise<T>
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const r = await fetch(API_BASE + path, {
    method,
    credentials: 'omit',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${path} failed: ${r.status} ${r.statusText}`)
  return r.json() as Promise<T>
}

/* --- API surface — 1:1 with workers/ao/api/routes_*.py ----------------- */

export const api = {
  getCompanies: () => get<Company[]>('/companies'),
  getCompany: (ticker: string) => get<Company>(`/companies/${ticker}`),
  setPosition: (ticker: string, body: { shares: number; costBasis: number }) =>
    send<Company>('POST', `/companies/${ticker}/position`, body),

  getReviewQueue: () => get<ReviewItem[]>('/review-queue'),
  resolveReview: (id: string, choice: string) =>
    send<{ id: string; choice: string }>('POST', `/review-queue/${id}/resolve`, { choice }),

  getActivity: (ticker?: string) =>
    get<ActivityRow[]>('/activity' + (ticker ? `?ticker=${ticker}` : '')),

  getUsage: () => get<Usage>('/usage'),
  getProviders: () => get<Provider[]>('/providers'),
  getRouting: () => get<RoutingRule[]>('/routing'),
  putRouting: (body: RoutingRule[]) => send<RoutingRule[]>('PUT', '/routing', body),

  getPortfolioTotals: () => get<PortfolioTotals>('/portfolio/totals'),
  getNews: (ticker: string, limit = 20) =>
    get<NewsItem[]>(`/companies/${ticker}/news?limit=${limit}`),
  getInsider: (ticker: string, limit = 20) =>
    get<InsiderTx[]>(`/companies/${ticker}/insider?limit=${limit}`),

  getNotificationPrefs: () => get<NotificationPrefs>('/settings/notifications'),
  putNotificationPrefs: (body: NotificationPrefs) =>
    send<NotificationPrefs>('PUT', '/settings/notifications', body),

  runAll: () => send<RunResponse>('POST', '/run'),
  runOne: (ticker: string) => send<RunResponse>('POST', `/companies/${ticker}/run`),

  // Admin — wipes fetched data (filings, results, metrics, activity, prices,
  // news, insider, usage). Keeps companies + their config. The Review screen
  // gets its demo items re-seeded so the feature is still demonstrable.
  wipe: () => send<{ status: string }>('POST', '/admin/wipe'),

  // POST /companies kicks off discovery; the caller polls /discovery/:jobId
  // until phase is 'found' (or 'error'). The discover() helper below wraps the
  // poll loop for the Companies add-flow.
  startDiscovery: (ticker: string) =>
    send<RunResponse>('POST', '/companies', { ticker, mode: 'auto' }),
  getDiscovery: (jobId: string) => get<DiscoveryStatus>(`/discovery/${jobId}`),

  async discover(ticker: string): Promise<DiscoveryStatus['result']> {
    const { jobId } = await this.startDiscovery(ticker)
    // Poll up to ~10s. The real agent pipeline will take longer; bump when wired.
    for (let i = 0; i < 50; i++) {
      const status = await this.getDiscovery(jobId)
      if (status.phase === 'found') return status.result
      if (status.phase === 'error') throw new Error(status.error ?? 'discovery failed')
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('discovery timed out')
  },
}
