import { expect, test } from '../base'
import { Api } from '../helpers/api'

/**
 * Period close (Phase 8): close a fiscal year (Lock), reopen it (Unlock), and
 * set it as the working year. Closed years are read-only for postings.
 */
test.describe.serial('Period close', () => {
  test('T1 — close, reopen, and set working year on a fiscal year', async ({ page, request }) => {
    const api = new Api(request)

    await page.goto('/settings/fiscal')
    await expect(page.getByRole('heading', { name: 'Fiscal Settings' })).toBeVisible({ timeout: 15_000 })

    const res = await api.get<{ docs: { id: number; label: string; status: string }[] }>('/fiscal-years')
    const years = res.docs
    const year = years[0]
    expect(year, 'no fiscal year found in seed').toBeTruthy()

    const row = page.locator('tr', { hasText: year.label }).first()

    // Close the year → lock button in actions column.
    await row.getByTitle('Close this fiscal year (read-only)').click()
    await expect(page.getByText('Fiscal year closed')).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('closed')).toBeVisible({ timeout: 10_000 })

    // Reopen the year → unlock button in actions column.
    await row.getByTitle('Open this fiscal year').click()
    await expect(page.getByText('Fiscal year opened')).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('active')).toBeVisible({ timeout: 10_000 })

    // Set as working year → check button in working column.
    await row.getByTitle('Set as working year').click()
    await expect(page.getByText('Working year set')).toBeVisible({ timeout: 15_000 })
  })
})
