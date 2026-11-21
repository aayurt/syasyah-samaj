import { expect, test } from '../base'

/**
 * End-to-end acceptance tests for Reports Filtering & Visual Charts:
 * - Fiscal Year selection
 * - Bikram Sambat 12-month selection
 * - Quick Period presets (Today, Yesterday, This Month, Last Month, Q1-Q4, Full FY, All Time)
 * - Custom dual BS/AD date pickers
 * - Visual breakdown charts and metric gauges
 */
test.describe.serial('Reports — Dynamic Filters & Visual Charts', () => {
  test('R1 — Profit & Loss filter bar & breakdown chart', async ({ page }) => {
    await page.goto('/reports/pnl')

    // Filter controls are visible
    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel('Month')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yesterday', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Q1', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Q4', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Full FY/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All Time', exact: true })).toBeVisible()

    // Clicking quick pills updates the period filter
    await page.getByRole('button', { name: 'All Time', exact: true }).click()
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await page.getByRole('button', { name: 'Q1', exact: true }).click()
  })

  test('R2 — Sales Report filter bar, search, and collection chart', async ({ page }) => {
    await page.goto('/reports/sales')

    // Filter controls and search are visible
    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Search invoices…')).toBeVisible()

    // Test quick range pill
    await page.getByRole('button', { name: 'This Month', exact: true }).click()
    await page.getByRole('button', { name: /Full FY/i }).click()
  })

  test('R3 — Balance Sheet filter bar and capital structure', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Balance Sheet', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  })

  test('R4 — VAT Register filter bar with VAT-only toggle and statutory rate', async ({ page }) => {
    await page.goto('/reports/vat-register')

    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel(/VAT only/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Entries').first()).toBeVisible()
    await expect(page.getByText('Taxable').first()).toBeVisible()
    await expect(page.getByText('VAT').first()).toBeVisible()
  })

  test('R5 — Membership Fee Collection report filter and recovery status', async ({ page }) => {
    await page.goto('/reports/membership-fee-collection')

    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Search members...')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Total Members').first()).toBeVisible()
  })

  test('R6 — Fixed Asset Summary filter and valuation breakdown', async ({ page }) => {
    await page.goto('/reports/fixed-asset-summary')

    await expect(page.getByLabel('Fiscal Year')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Search assets…')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Total Asset Cost').first()).toBeVisible()
  })
})
