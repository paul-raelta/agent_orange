import { expect, test } from '@playwright/test'
import { addCompany, wipeDb } from './_setup'

test.beforeEach(async ({ request }) => {
  await wipeDb(request)
})

test('add → archive → restore → permanently delete an S&P 500 ticker', async ({ page, request }) => {
  // Seed AAPL via the batch endpoint so the test isn't bound to the multi-stage
  // discovery wizard (which is covered separately by add-companies-ui below).
  await addCompany(request, 'AAPL')

  await page.goto('/companies')
  await expect(page.getByText('AAPL', { exact: false }).first()).toBeVisible()

  // Archive via the company deep-dive (Archive lives on the company page).
  await page.getByText('AAPL', { exact: false }).first().click()
  await expect(page).toHaveURL(/\/company\/AAPL$/)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /archive/i }).first().click()

  // Should land back on watchlist; AAPL is gone from the active list.
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/companies')
  await expect(page.locator('.cfg-row').filter({ hasText: 'AAPL' })).toHaveCount(0)

  // Reveal archived → restore.
  await page.getByRole('button', { name: /^ARCHIVED \(/i }).click()
  const archivedRow = page.locator('.cfg-row.archived').filter({ hasText: 'AAPL' })
  await expect(archivedRow).toHaveCount(1)
  await archivedRow.getByRole('button', { name: /restore/i }).click()
  await expect(page.locator('.cfg-row').filter({ hasText: 'AAPL' })).toHaveCount(1)

  // Archive again so we can permanently delete (delete requires archived state).
  await page.getByText('AAPL', { exact: false }).first().click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /archive/i }).first().click()
  await page.goto('/companies')
  await page.getByRole('button', { name: /^ARCHIVED \(/i }).click()
  const archived = page.locator('.cfg-row.archived').filter({ hasText: 'AAPL' })

  // Two confirms in the handler — accept both. Regression guard for 3379971
  // ("Fix … PERMANENTLY DELETE silent 500").
  let dialogs = 0
  page.on('dialog', (d) => {
    dialogs++
    d.accept()
  })
  await archived.getByRole('button', { name: /permanently delete/i }).click()
  await expect.poll(() => dialogs, { timeout: 5_000 }).toBeGreaterThanOrEqual(2)

  // Wait for the row to disappear (mutation is async).
  await expect(page.locator('.cfg-row.archived').filter({ hasText: 'AAPL' })).toHaveCount(0, {
    timeout: 10_000,
  })

  // And the API should agree.
  const list = await request.get('http://127.0.0.1:8000/api/v1/companies?archived=true')
  const json = await list.json()
  expect(json.find((c: any) => c.ticker === 'AAPL')).toBeUndefined()
})
