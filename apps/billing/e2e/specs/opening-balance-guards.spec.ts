import { expect, test } from '../base'

/**
 * Opening balance guards (Phase 5 OB1-OB4): invalid balances must be rejected
 * and the save blocked, while valid positive balances are accepted.
 *
 * Notes: OB1 (empty Chart of Accounts) and OB2/OB3 (missing heading /
 * subheading) require destructive Chart-of-Accounts mutations and are
 * guarded by the component's empty-state modal and per-account existence
 * validation; they are not mutated here to keep the shared seed intact.
 */
test.describe.serial('Opening balance guards', () => {
  test('OB4 — a negative opening balance is rejected and Save is blocked', async ({ page }) => {
    await page.goto('/opening-balances')
    await expect(page.getByRole('heading', { name: 'Opening Balances' })).toBeVisible({ timeout: 15_000 })

    const row = page.locator('tr', { hasText: 'Cash in Hand' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    const input = row.locator('input[type="number"]')

    await input.fill('-500')
    await expect(page.getByRole('button', { name: 'Save Opening Balances' })).toBeDisabled()

    // Clearing the invalid value re-enables Save.
    await input.fill('')
    await expect(page.getByRole('button', { name: 'Save Opening Balances' })).not.toBeDisabled()
  })

  test('valid positive opening balances are accepted and saved', async ({ page }) => {
    await page.goto('/opening-balances')

    const row = page.locator('tr', { hasText: 'Cash in Hand' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.locator('input[type="number"]').fill('12345.67')

    await expect(page.getByRole('button', { name: 'Save Opening Balances' })).not.toBeDisabled()
    await page.getByRole('button', { name: 'Save Opening Balances' }).click()
    await expect(page.getByText('Opening balances saved')).toBeVisible({ timeout: 15_000 })
  })
})
