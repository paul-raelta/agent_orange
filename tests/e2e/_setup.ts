import { APIRequestContext, expect } from '@playwright/test'

export const API_BASE = 'http://127.0.0.1:8000/api/v1'

// Reset to a known baseline. wipe() restores NVDA via ensure_demo_anchor —
// every other ticker, review row, news row, etc. is gone.
export async function wipeDb(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${API_BASE}/admin/wipe`)
  expect(res.ok(), `wipe failed: ${res.status()}`).toBeTruthy()
}

// Fast non-UI seed of a tracked ticker via the batch endpoint, so specs that
// need a non-NVDA company don't have to drive the discovery wizard.
export async function addCompany(
  request: APIRequestContext,
  ticker: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/companies/batch`, {
    data: { tickers: [ticker] },
  })
  expect(res.ok(), `addCompany(${ticker}) failed: ${res.status()}`).toBeTruthy()
}

export async function archiveCompany(
  request: APIRequestContext,
  ticker: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/companies/${ticker}/archive`)
  expect(res.ok(), `archive(${ticker}) failed: ${res.status()}`).toBeTruthy()
}

export async function restoreCompany(
  request: APIRequestContext,
  ticker: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/companies/${ticker}/restore`)
  expect(res.ok(), `restore(${ticker}) failed: ${res.status()}`).toBeTruthy()
}
