import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { API_BASE } from './_setup'

// The wipe endpoint only restores NVDA — it doesn't seed review items.
// Run the full seed script (which creates SNDK + the conflict review row)
// against the test DB.
test.beforeAll(() => {
  execSync('cd workers && .venv/bin/python -m ao.db.seed', {
    env: { ...process.env, DATABASE_URL: 'sqlite+aiosqlite:///./var/ao.test.db' },
    stdio: 'inherit',
  })
})

test('review queue lists at least one demo item; resolving removes it', async ({ page, request }) => {
  // Sanity: the API reports a non-empty queue.
  const before = await request.get(`${API_BASE}/review-queue`)
  expect(before.ok()).toBeTruthy()
  const beforeJson = await before.json()
  expect(beforeJson.length, 'demo review queue is empty — seed script did not run').toBeGreaterThan(
    0,
  )

  await page.goto('/review')
  await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible()

  // First card → first candidate "USE …" button.
  const firstCard = page.locator('.rv-card').first()
  await expect(firstCard).toBeVisible()
  const useBtn = firstCard.getByRole('button', { name: /^use /i }).first()
  await useBtn.click()

  // The card is marked resolved (optimistic) within the same render; eventually
  // the queue length shrinks server-side too.
  await expect(firstCard).toHaveClass(/resolved/, { timeout: 5_000 })

  await expect
    .poll(async () => (await (await request.get(`${API_BASE}/review-queue`)).json()).length, {
      timeout: 5_000,
    })
    .toBeLessThan(beforeJson.length)
})
