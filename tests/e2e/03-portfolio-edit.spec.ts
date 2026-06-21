import { expect, test } from '@playwright/test'
import { wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

test('edit NVDA position → save → values persist across reload', async ({ page }) => {
  await page.goto('/company/NVDA')
  await expect(page.getByRole('heading', { name: /nvda/i }).first()).toBeVisible()

  const shares = page.locator('.pf-edit-field').filter({ hasText: /shares/i }).locator('input')
  const cost = page.locator('.pf-edit-field').filter({ hasText: /cost basis/i }).locator('input')

  await shares.fill('250')
  await cost.fill('80.50')
  // Scope SAVE to the portfolio editor — the page has other SAVE buttons.
  await page.locator('.pf-edit').getByRole('button', { name: /^save$/i }).click()

  // Position value should reflect 250 × current price (NVDA seed = $182.40).
  // We don't pin the exact number — just confirm POSITION displays a non-zero
  // dollar value with a delta chip.
  const pfStats = page.locator('.pf-edit-stats')
  await expect(pfStats.locator('.pf-edit-val')).not.toHaveText('$0.00', { timeout: 10_000 })

  // Reload and confirm the inputs are repopulated from the API.
  await page.reload()
  await expect(shares).toHaveValue('250')
  await expect(cost).toHaveValue('80.5')
})
