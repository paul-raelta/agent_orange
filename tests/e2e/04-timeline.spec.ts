import { expect, test } from '@playwright/test'
import { addCompany, archiveCompany, restoreCompany, wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

test('timeline renders NVDA lane; archived companies disappear', async ({ page, request }) => {
  // Add a second ticker so we can prove the archived one drops without losing
  // the whole grid.
  await addCompany(request, 'AAPL')

  await page.goto('/timeline')
  await expect(page.getByRole('heading', { name: /filing timeline/i })).toBeVisible()

  // Both lanes present.
  const desktop = page.locator('.tl-desktop')
  await expect(desktop.locator('.tl-lanelabel').filter({ hasText: 'NVDA' })).toHaveCount(1)
  await expect(desktop.locator('.tl-lanelabel').filter({ hasText: 'AAPL' })).toHaveCount(1)

  // Archive NVDA via API; reload; lane should disappear (regression guard for 3379971).
  await archiveCompany(request, 'NVDA')
  await page.reload()
  await expect(desktop.locator('.tl-lanelabel').filter({ hasText: 'NVDA' })).toHaveCount(0)
  await expect(desktop.locator('.tl-lanelabel').filter({ hasText: 'AAPL' })).toHaveCount(1)

  // Restore NVDA so the demo anchor is back.
  await restoreCompany(request, 'NVDA')
})

test('mobile viewport renders the vertical agenda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/timeline')

  const mobile = page.locator('.tl-mobile')
  await expect(mobile).toBeVisible()
  await expect(mobile.locator('.tla-card').filter({ hasText: 'NVDA' })).toHaveCount(1)
})
