import { expect, test } from '@playwright/test'
import { API_BASE, wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

test('activity log renders + filters by ticker after a pipeline run', async ({ page, request }) => {
  // Trigger a run so there's at least one activity row to assert against.
  const run = await request.post(`${API_BASE}/companies/NVDA/run`)
  expect(run.ok()).toBeTruthy()

  await page.goto('/activity')
  await expect(page.getByRole('heading', { name: /activity log/i })).toBeVisible()

  // Wait for the run to surface in the log (background task; give it a beat).
  await expect.poll(async () => page.locator('.log-row').count(), { timeout: 30_000 }).toBeGreaterThan(0)

  // Filter by NVDA — still has rows.
  await page.getByRole('button', { name: 'NVDA', exact: true }).click()
  await expect.poll(async () => page.locator('.log-row').count(), { timeout: 10_000 }).toBeGreaterThan(0)
})
