import { expect, test } from '@playwright/test'
import { API_BASE, wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

// Note: this spec does NOT wait for the full pipeline to drain — it just
// proves the wiring (button → daemon → activity log) is alive. Real LLM cost
// is at most one short Haiku call per tracked company.
test('RUN ALL AGENTS triggers a daemon run + activity entries within 60s', async ({ page, request }) => {
  // Baseline activity count.
  const beforeRes = await request.get(`${API_BASE}/activity`)
  const beforeCount = (await beforeRes.json()).length

  await page.goto('/')
  // The button label includes the leading icon ('▸ RUN ALL AGENTS'); match by substring.
  const runBtn = page.getByRole('button', { name: /run all agents/i })
  await expect(runBtn).toBeVisible()
  await runBtn.click()

  // Button enters held / running state briefly (or stays in the not-yet-flipped state).
  await expect(page.getByRole('button', { name: /running…|run all agents/i })).toBeVisible()

  // The dispatcher writes activity rows as it goes; poll until at least one
  // new row lands.
  await expect
    .poll(
      async () => (await (await request.get(`${API_BASE}/activity`)).json()).length,
      { timeout: 60_000, intervals: [1000, 2000, 5000] },
    )
    .toBeGreaterThan(beforeCount)

  // And the UI's Activity screen sees it.
  await page.goto('/activity')
  await expect.poll(async () => page.locator('.log-row').count(), { timeout: 10_000 }).toBeGreaterThan(0)
})
