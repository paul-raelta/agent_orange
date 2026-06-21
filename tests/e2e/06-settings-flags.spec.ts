import { expect, test } from '@playwright/test'
import { API_BASE, wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

// The UI caches feature flags in localStorage with `initialData` + `staleTime`,
// so it won't refetch the API for 30s after first load. Driving the toggle
// through the UI itself sidesteps that cache: every click writes through to
// both the cache and the server, so subsequent renders pick up the new state.
test('toggling LABS · Consensus surfaces the CONS column on the deep-dive', async ({ page }) => {
  // Start from a known baseline: navigate, then click the toggle until it's OFF.
  await page.goto('/settings')
  const toggle = page
    .locator('.ff-row')
    .filter({ hasText: /consensus vs actual/i })
    .locator('button.sw')
  await expect(toggle).toBeVisible()

  const isOn = async () => toggle.evaluate((el) => el.classList.contains('on'))
  if (await isOn()) {
    await toggle.click()
    await expect(toggle).not.toHaveClass(/\bon\b/)
  }

  // Deep-dive surface absent while OFF.
  await page.goto('/company/NVDA')
  await expect(page.locator('th.cons-col')).toHaveCount(0)

  // OFF → ON: surface appears.
  await page.goto('/settings')
  const t1 = page
    .locator('.ff-row')
    .filter({ hasText: /consensus vs actual/i })
    .locator('button.sw')
  await t1.click()
  await expect(t1).toHaveClass(/\bon\b/)
  await page.goto('/company/NVDA')
  await expect(page.locator('th.cons-col').first()).toBeVisible()

  // ON → OFF: surface disappears.
  await page.goto('/settings')
  const t2 = page
    .locator('.ff-row')
    .filter({ hasText: /consensus vs actual/i })
    .locator('button.sw')
  await t2.click()
  await expect(t2).not.toHaveClass(/\bon\b/)
  await page.goto('/company/NVDA')
  await expect(page.locator('th.cons-col')).toHaveCount(0)
})
