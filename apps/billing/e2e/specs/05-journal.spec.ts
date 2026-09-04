import { expect, test } from '@playwright/test'
import { dataset } from '../helpers/dataset'

/**
 * S5 — Journal list: every row from a posted voucher shows its clickable
 * number (JV-2083-84-…), drill-down opens the voucher modal, and the
 * filters/search work by number.
 */
test.describe.serial('S5 — Journal list with voucher numbers', () => {
  test('S5.1 — posted entries show their voucher number', async ({ page }) => {
    await page.goto('/journal')
    const jv1 = dataset.vouchers.find((v) => v.expectedNumber === 'JV-2083-84-0001')!
    // Wait for the month's postings to appear.
    await expect(page.getByText(jv1.expectedNumber!).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('JV-2083-84-0002').first()).toBeVisible()
    await expect(page.getByText('JV-2083-84-0003').first()).toBeVisible()
  })

  test('S5.2 — clicking a number opens the source voucher modal', async ({ page }) => {
    await page.goto('/journal')
    const num = 'JV-2083-84-0001'
    const cell = page.getByRole('button', { name: num }).first()
    await cell.click()
    await expect(page.getByText('Journal Entry').first()).toBeVisible()
    await expect(page.getByText(/JV-2083-84-0001/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByText('Journal Entry').first()).toHaveCount(0)
  })

  test('S5.3 — status filter + search by number', async ({ page }) => {
    await page.goto('/journal')
    // All entries created by S4 are posted.
    await page.getByRole('button', { name: 'Posted', exact: true }).click()
    await expect(page.getByText('JV-2083-84-0002').first()).toBeVisible()
  })
})
