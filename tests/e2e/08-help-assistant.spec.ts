import { expect, test } from '@playwright/test'
import { wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
  // Per-test browser context is fresh → localStorage is empty by default, so
  // the launcher (closed-state) renders without any cleanup here.
})

test('help assistant opens → streams a grounded answer → state persists', async ({ page }) => {
  await page.goto('/')

  // Launcher visible until clicked.
  const launcher = page.getByRole('button', { name: /open help assistant/i })
  await expect(launcher).toBeVisible()
  await launcher.click()

  const panel = page.getByRole('dialog', { name: /help assistant/i })
  await expect(panel).toBeVisible()

  // Input is a single-line <input> identified by its placeholder.
  const input = panel.getByPlaceholder(/ask a question/i)
  await input.fill('How do I add a company?')
  await input.press('Enter')

  // The first assistant bubble is the canned greeting; wait for the second
  // bubble to accumulate at least a few characters of streamed text.
  await expect
    .poll(async () => {
      const bubbles = await panel.locator('.ha-msg.ha-bot .ha-b').allInnerTexts()
      return bubbles.length >= 2 ? (bubbles[bubbles.length - 1] || '').length : 0
    }, { timeout: 30_000 })
    .toBeGreaterThan(5)

  // Reload — open state should persist via localStorage.
  await page.reload()
  await expect(page.getByRole('dialog', { name: /help assistant/i })).toBeVisible()
})
