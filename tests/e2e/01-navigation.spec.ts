import { expect, test } from '@playwright/test'
import { wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

const PAGES: { label: string; path: string; heading: RegExp }[] = [
  { label: 'Watchlist', path: '/', heading: /watchlist/i },
  { label: 'Timeline', path: '/timeline', heading: /filing timeline/i },
  { label: 'Review', path: '/review', heading: /review queue/i },
  { label: 'Companies', path: '/companies', heading: /companies/i },
  { label: 'Activity', path: '/activity', heading: /activity log/i },
  { label: 'Settings', path: '/settings', heading: /settings/i },
]

test('desktop: every top-nav link routes + renders its screen', async ({ page }) => {
  await page.goto('/')
  for (const p of PAGES) {
    await page.getByRole('link', { name: p.label }).first().click()
    await expect(page).toHaveURL(p.path === '/' ? /\/$/ : new RegExp(p.path + '$'))
    await expect(page.getByRole('heading', { name: p.heading })).toBeVisible()
  }
})

test('mobile viewport: bottom-nav is reachable + every link works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }) // iPhone 13/14
  await page.goto('/')

  // The nav becomes the bottom-pinned bar at <=700px container width — every
  // NavLink should still be clickable (regression guard for commit 4a6b1f5).
  for (const p of PAGES) {
    const link = page.getByRole('link', { name: p.label }).first()
    await expect(link).toBeVisible()

    // The nav must sit inside the visible viewport — otherwise iOS Safari's
    // address bar is hiding it again.
    const navBox = await page.locator('.nav').boundingBox()
    const viewport = page.viewportSize()!
    expect(navBox).not.toBeNull()
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(viewport.height + 1)

    await link.click()
    await expect(page).toHaveURL(p.path === '/' ? /\/$/ : new RegExp(p.path + '$'))
  }
})
