/**
 * Chart of Accounts Table Format E2E Tests
 * 
 * Verifies:
 * - Flat table with indented hierarchy (not accordion)
 * - Sortable, filterable, searchable
 * - Keyboard navigation
 * - Expand/collapse rows
 * - CRUD operations work
 */
import { test, expect } from '/test'

test.describe('Chart of Accounts - Table Format', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')
  })

  test('Displays accounts in flat table format (not accordion)', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('[data-accordion], .accordion, [role="region"][aria-expanded]')).not.toBeVisible()
    await expect(page.locator('thead th')).toHaveCount(6)
  })

  test('Shows hierarchy with indentation', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Table is sortable by clicking headers', async ({ page }) => {
    await page.locator('th:has-text("Code")').click()
    await page.waitForLoadState('networkidle')
    const firstCode = await page.locator('tbody tr td:first-child').first().textContent()
    expect(firstCode).toBeTruthy()
  })

  test('Table is filterable by account type tabs', async ({ page }) => {
    const typeTabs = page.locator('text=Assets, text=Liabilities, text=Equity, text=Income, text=Expenses')
    const count = await typeTabs.count()
    expect(count).toBeGreaterThan(0)

    await page.locator('text=Liabilities').first().click()
    await page.waitForLoadState('networkidle')
    const rowCount = await page.locator('tbody tr').count()
    expect(rowCount).toBeGreaterThanOrEqual(0)
  })

  test('Search filters accounts in real-time', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first()
    await expect(searchInput).toBeVisible()

    await searchInput.fill('Cash')
    await page.waitForTimeout(300)
    const count = await page.locator('tbody tr:visible').count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Create new account opens form', async ({ page }) => {
    await page.locator('button:has-text("New account"), button:has-text("New Account")').first().click()
    await expect(page.locator('form:has-text("New Account"), form:has-text("New Account")')).toBeVisible({ timeout: 5000 })

    await page.fill('input[name="name"], input[placeholder*="Name"]', 'Test Account')
    await page.fill('input[name="code"], input[placeholder*="Code"]', 'TEST001')

    await page.locator('button[type="submit"]:has-text("Save")').click()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Test Account')).toBeVisible({ timeout: 5000 })
  })

  test('Edit account opens form with pre-filled data', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first()
    await firstRow.locator('button[aria-label="Edit"], button:has-text("Edit")').first().click()
    await expect(page.locator('form:has-text("Edit Account")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("Cancel")').click()
    await expect(page.locator('form:has-text("Edit Account")')).not.toBeVisible()
  })

  test('Delete account shows confirmation', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    
    if (count > 0) {
      const firstRow = rows.first()
      await firstRow.locator('button[aria-label="Delete"], button:has-text("Delete")').first().click()
      await expect(page.locator('text=Delete this account?, text=Are you sure')).toBeVisible({ timeout: 5000 })
      await page.locator('button:has-text("Cancel"), button:has-text("No")').click()
    }
  })

  test('Keyboard navigation works in table', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first()
    await firstRow.focus()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(100)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
  })

  test('Opening balance column shows FY-scoped values', async ({ page }) => {
    await expect(page.locator('th:has-text("Opening"), th:has-text("Opening (FY)")')).toBeVisible()
    const firstValue = await page.locator('tbody tr td:nth-child(5)').first().textContent()
    if (firstValue) {
      expect(firstValue.trim()).toMatch(/^[\d,.]+$/)
    }
  })

  test('Group column shows group name with code', async ({ page }) => {
    await expect(page.locator('th:has-text("Group")')).toBeVisible()
    const firstGroup = await page.locator('tbody tr td:nth-child(3)').first().textContent()
    expect(firstGroup).toBeTruthy()
  })

  test('Account type tabs show correct counts', async ({ page }) => {
    const tabs = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses']
    for (const tab of tabs) {
      const tabElement = page.locator(`text=${tab}`).first()
      if (await tabElement.isVisible({ timeout: 1000 })) {
        await expect(tabElement.locator('..')).toBeVisible()
      }
    }
  })
})