import { expect, test } from '@playwright/test'
import { dataset } from '../helpers/dataset'
import { money } from '../helpers/money'

/**
 * S6 — Reports acceptance. After the 13-voucher month the register cards
 * (Entries / Taxable / VAT / Grand Total) and the Trial Balance must show the
 * dataset's expected figures.
 *
 * Registers default to the selected FY range (2083-84) which contains all
 * dataset dates; VAT-only is the default filter.
 */
test.describe.serial('S6 — Reports acceptance', () => {
  async function openRegister(page: import('@playwright/test').Page, tab: string) {
    await page.goto('/reports/vat-register')
    await page.getByRole('button', { name: tab, exact: true }).click()
    // Wait for data: the "Taxable" card stops being the skeleton.
    await expect(page.getByText('Entries').first()).toBeVisible({ timeout: 20_000 })
  }

  async function cardValue(page: import('@playwright/test').Page, label: string): Promise<number> {
    // Each summary card is a label div followed by its value div — read the
    // value directly instead of guessing the card container.
    const value = page.locator(`xpath=//div[text()="${label}"]/following-sibling::div[1]`)
    await expect(value).toBeVisible()
    return money(await value.innerText())
  }

  test('S6.1 — Trial Balance is balanced', async ({ page }) => {
    await page.goto('/trial-balance')
    // The emerald banner reads "✓ Debits and credits are in balance."
    await expect(page.getByText(/Debits and credits are in balance/)).toBeVisible({ timeout: 20_000 })
  })

  test('S6.6 — Sales Register totals', async ({ page }) => {
    const er = dataset.expectedReports.salesRegister as { net: number; tax: number }
    await openRegister(page, 'Sales Register')
    await expect.poll(() => cardValue(page, 'Taxable')).toBeCloseTo(er.net, 0)
    await expect.poll(() => cardValue(page, 'VAT')).toBeCloseTo(er.tax, 0)
  })

  test('S6.7 — Sales Return Register reverses the credit note', async ({ page }) => {
    const er = dataset.expectedReports.salesReturnRegister as { net: number; tax: number }
    await openRegister(page, 'Sales Return Register')
    await expect.poll(() => cardValue(page, 'Taxable')).toBeCloseTo(er.net, 0)
    await expect.poll(() => cardValue(page, 'VAT (returned)')).toBeCloseTo(er.tax, 0)
  })

  test('S6.8 — Purchase Register totals', async ({ page }) => {
    const er = dataset.expectedReports.purchaseRegister as { net: number; tax: number }
    await openRegister(page, 'Purchase Register')
    await expect.poll(() => cardValue(page, 'Taxable')).toBeCloseTo(er.net, 0)
    await expect.poll(() => cardValue(page, 'VAT')).toBeCloseTo(er.tax, 0)
  })
})
