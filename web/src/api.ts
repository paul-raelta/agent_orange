/* Agent Orange — data layer seam (§6).
   This module is the ONLY place that knows where data comes from. Today it
   resolves the in-repo fixture; to go live, point these functions at the
   workers/ REST API (GET /companies, GET /companies/:ticker, GET /review-queue,
   POST /review-queue/:id/resolve, GET /activity, GET /usage, GET /providers,
   GET /routing, POST /run) and delete the fixture import. Components and the
   React Query hooks in hooks.ts don't change. */
import { AO_DATA } from './data'
import type {
  ActivityRow,
  Company,
  Provider,
  ReviewItem,
  RoutingRule,
  Usage,
} from './types'

// Simulate network latency so loading states are exercised like the real API.
const LATENCY = 120
const wait = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), LATENCY))

// Return deep-ish copies so optimistic UI mutations never scribble the fixture.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const api = {
  getCompanies: (): Promise<Company[]> => wait(clone(AO_DATA.companies)),

  getCompany: (ticker: string): Promise<Company | undefined> =>
    wait(clone(AO_DATA.companies.find((c) => c.ticker === ticker))),

  getReviewQueue: (): Promise<ReviewItem[]> => wait(clone(AO_DATA.reviewQueue)),

  resolveReview: (id: string, choice: string): Promise<{ id: string; choice: string }> =>
    wait({ id, choice }),

  getActivity: (ticker?: string): Promise<ActivityRow[]> =>
    wait(
      clone(ticker ? AO_DATA.activity.filter((a) => a.agent === ticker) : AO_DATA.activity),
    ),

  getUsage: (): Promise<Usage> => wait(clone(AO_DATA.usage)),

  getProviders: (): Promise<Provider[]> => wait(clone(AO_DATA.providers)),

  getRouting: (): Promise<RoutingRule[]> => wait(clone(AO_DATA.routing)),

  // POST /run — trigger all agents. The real backend kicks off agent jobs and
  // the UI subscribes to status; here we just resolve after a beat.
  runAll: (): Promise<{ lastSync: string }> =>
    new Promise((resolve) => setTimeout(() => resolve({ lastSync: 'just now' }), 2600)),

  // POST /companies — add + discover. The real backend runs a live discovery
  // agent; here we synthesize a plausible result after a beat.
  discover: (ticker: string): Promise<DiscoveryResult> =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            ir:
              ticker.toUpperCase() === 'AMD'
                ? 'ir.amd.com'
                : 'investors.' + ticker.toLowerCase() + '.com',
            sec: 'EDGAR · search “' + ticker.toUpperCase() + '”',
            cadence: 'Quarterly (inferred from last 8 filings)',
            window: 'predicted ±10 days around prior dates',
          }),
        1900,
      ),
    ),
}

export type DiscoveryResult = {
  ir: string
  sec: string
  cadence: string
  window: string
}
