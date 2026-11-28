# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/billing/e2e/specs/11-fiscal-year.spec.ts >> Fiscal Year >> add fiscal year modal is accessible
- Location: apps/billing/e2e/specs/11-fiscal-year.spec.ts:33:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /add new fiscal year/i })

```

# Test source

```ts
  1  | /** Fiscal Year E2E Tests
  2  | 
  3  |  * Verifies:
  4  |  * - Fiscal year switcher is visible and functional
  5  |  * - Year selection works correctly
  6  |  * - Closed/working year badges display properly
  7  |  * - Add fiscal year modal opens and functions
  8  |  * - Fiscal year selection persists across navigation
  9  |  */
  10 | 
  11 | import { test, expect } from '../base'
  12 | 
  13 | test.describe('Fiscal Year', () => {
  14 |   test('fiscal year switcher is visible on homepage', async ({ page }) => {
  15 |     // Page is already on homepage from base fixture
  16 |     await expect(page.getByRole('combobox', { name: /fiscal year/i })).toBeVisible()
  17 |     await expect(page.getByRole('button', { name: /add new fiscal year/i })).toBeVisible()
  18 |   })
  19 | 
  20 |   test('selects a fiscal year from the dropdown', async ({ page }) => {
  21 |     // Page is already on homepage from base fixture
  22 |     const yearSelect = page.getByRole('combobox', { name: /fiscal year/i })
  23 |     await expect(yearSelect).toBeVisible()
  24 |     // Try to select a year option if available
  25 |     const yearOptions = yearSelect.locator('option')
  26 |     const optionCount = await yearOptions.count()
  27 |     if (optionCount > 0) {
  28 |       await yearSelect.selectOption({ index: 0 })
  29 |       await page.waitForTimeout(500)
  30 |     }
  31 |   })
  32 | 
  33 |   test('add fiscal year modal is accessible', async ({ page }) => {
  34 |     // Page is already on homepage from base fixture
  35 |     // Click add year button
> 36 |     await page.getByRole('button', { name: /add new fiscal year/i }).click()
     |                                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  37 |     // Wait for modal or check if it opens
  38 |     await page.waitForTimeout(500)
  39 |     // The add year button opens a modal - verify it's interactive
  40 |     const modal = page.locator('text=Add new fiscal year')
  41 |     await expect(modal).toBeVisible({ timeout: 5000 })
  42 |   })
  43 | 
  44 |   test('fiscal year badge shows working year indicator', async ({ page }) => {
  45 |     // Page is already on homepage from base fixture
  46 |     // Check for the working year ✓ badge
  47 |     const workingBadge = page.getByTitle('Working year')
  48 |     const badgeCount = await workingBadge.count()
  49 |     // Badge may or may not be present depending on selected year state
  50 |     // Just verify the element is accessible if it exists
  51 |     if (badgeCount > 0) {
  52 |       await expect(workingBadge.first()).toBeVisible()
  53 |     }
  54 |   })
  55 | })
```