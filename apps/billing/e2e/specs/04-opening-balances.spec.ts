import { expect, test } from '../base'
import { Api } from '../helpers/api'

/**
 * Opening balances (Phase 5): enter company-level opening balances per GL
 * account for the active fiscal year, save, and verify persistence.
 */
test.describe.serial('Opening balances', () => {
  const ENTRIES: [string, number][] = [
    ['Cash in Hand', 90000],
    ['Bank Account', 400000],
    ['Petty Cash', 10000],
    ['Capital', 500000],
  ]

  test('enter opening balances and save them for the active fiscal year', async ({ page, request }) => {
    const api = new Api(request)
    await page.goto('/opening-balances')

    await expect(page.getByRole('heading', { name: 'Opening Balances' })).toBeVisible({ timeout: 15_000 })

    // The seeded working year 2083-84 should be selected.
    await expect(page.locator('select').first()).toContainText('2083-84')

    // Enter an opening balance for each account row.
    for (const [name, amount] of ENTRIES) {
      const row = page.locator('tr', { hasText: name }).first()
      await expect(row).toBeVisible({ timeout: 10_000 })
      await row.locator('input[type="number"]').fill(String(amount))
    }

    await page.getByRole('button', { name: 'Save Opening Balances' }).click()
    await expect(page.getByText('Opening balances saved')).toBeVisible({ timeout: 15_000 })

    // Reload → balances persist.
    await page.reload()
    for (const [name, amount] of ENTRIES) {
      const row = page.locator('tr', { hasText: name }).first()
      await expect(row.locator('input[type="number"]')).toHaveValue(String(amount), {
        timeout: 10_000,
      })
    }

    // Clean up so the fixture is isolated for downstream suites.
    // Clean up so the fixture is isolated for downstream suites (best effort).
    try {
      const byName = async (name: string) => {
        const doc = await api.findOne('gl-accounts', 'name', name)
        return Number(doc!.id)
      }
      const year = await api.findOne('fiscal-years', 'label', '2083-84')
      for (const [name] of ENTRIES) {
        const accountId = await byName(name)
        const existing = await api.findOne('opening-balances', 'account', accountId)
        if (existing && year) {
          await api.delete(`/opening-balances/${Number(existing.id)}`)
        }
      }
    } catch {
      /* cleanup must not fail the suite */
    }
  })
})
