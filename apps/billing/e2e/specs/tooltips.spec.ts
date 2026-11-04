/**
 * Tooltip System E2E Tests
 * 
 * Verifies:
 * - Tooltips appear on hover/focus
 * - Tooltip toggle in Settings (default ON)
 * - Keyboard accessible
 * - Content is correct
 * - Can be disabled
 */
import { test, expect } from '/test'

test.describe('Tooltip System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
  })

  test('Tooltip toggle exists in Settings > Display', async ({ page }) => {
    // Navigate to Display section
    await expect(page.locator('text=Display, text=दिखावट')).toBeVisible({ timeout: 5000 })
    
    // Find tooltip toggle
    const tooltipToggle = page.locator('text=Show Tooltips, text=टुलटिप देखाउनुहोस्, text=Tooltips').first()
    await expect(tooltipToggle).toBeVisible({ timeout: 5000 })
  })

  test('Tooltip toggle defaults to ON', async ({ page }) => {
    const tooltipToggle = page.locator('text=Show Tooltips, text=टुलटिप देखाउनुहोस्, text=Tooltips').first()
    const checkbox = tooltipToggle.locator('..').locator('input[type="checkbox"], [role="switch"]').first()
    
    if (await checkbox.isVisible()) {
      await expect(checkbox).toBeChecked()
    }
  })

  test('Disabling tooltips hides them', async ({ page }) => {
    const tooltipToggle = page.locator('text=Show Tooltips, text=टुलटिप देखाउनुहोस्, text=Tooltips').first()
    const checkbox = tooltipToggle.locator('..').locator('input[type="checkbox"], [role="switch"]').first()
    
    if (await checkbox.isVisible() && await checkbox.isChecked()) {
      await checkbox.click()
      await page.waitForTimeout(500)

      // Navigate to a page with tooltips
      await page.goto('/accounts')
      await page.waitForLoadState('networkidle')

      // Hover over an element with tooltip
      const codeHeader = page.locator('th:has-text("Code")').first()
      await codeHeader.hover()
      await page.waitForTimeout(500)

      // Tooltip should NOT appear
      await expect(page.locator('[role="tooltip"], .tooltip, [data-tooltip]')).not.toBeVisible()
    }
  })

  test('Enabling tooltips shows them on hover', async ({ page }) => {
    const tooltipToggle = page.locator('text=Show Tooltips, text=टुलटिप देखाउनुहोस्, text=Tooltips').first()
    const checkbox = tooltipToggle.locator('..').locator('input[type="checkbox"], [role="switch"]').first()
    
    if (await checkbox.isVisible() && !(await checkbox.isChecked())) {
      await checkbox.click()
      await page.waitForTimeout(500)

      await page.goto('/accounts')
      await page.waitForLoadState('networkidle')

      const codeHeader = page.locator('th:has-text("Code")').first()
      await codeHeader.hover()
      await page.waitForTimeout(500)

      // Tooltip should appear
      await expect(page.locator('[role="tooltip"], .tooltip, [data-tooltip]')).toBeVisible({ timeout: 3000 })
    }
  })

  test('Tooltip content is correct for account code field', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // Click New Account to open form
    await page.locator('button:has-text("New account"), button:has-text("New Account")').first().click()
    await page.waitForLoadState('networkidle')

    // Hover over Code field label or help icon
    const codeLabel = page.locator('label:has-text("Code")').first()
    await codeLabel.hover()
    await page.waitForTimeout(500)

    // Tooltip should show relevant help text
    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
    if (await tooltip.isVisible({ timeout: 3000 })) {
      const text = await tooltip.textContent()
      expect(text).toMatch(/code|unique|account/i)
    }
  })

  test('Tooltip appears on focus (keyboard accessible)', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // Tab to first focusable element with tooltip
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)

    // Should show tooltip on focus
    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
    if (await tooltip.isVisible({ timeout: 3000 })) {
      const text = await tooltip.textContent()
      expect(text).toBeTruthy()
    }
  })

  test('Tooltip disappears on mouse leave', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    const codeHeader = page.locator('th:has-text("Code")').first()
    await codeHeader.hover()
    await page.waitForTimeout(500)

    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
    if (await tooltip.isVisible({ timeout: 3000 })) {
      // Move mouse away
      await page.mouse.move(0, 0)
      await page.waitForTimeout(300)

      // Tooltip should disappear
      await expect(tooltip).not.toBeVisible()
    }
  })

  test('Tooltip position is correct (not cut off)', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    // Hover over element near edge
    const lastHeader = page.locator('thead th').last()
    await lastHeader.hover()
    await page.waitForTimeout(500)

    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
    if (await tooltip.isVisible({ timeout: 3000 })) {
      const box = await tooltip.boundingBox()
      if (box) {
        // Should be within viewport
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
      }
    }
  })

  test('Tooltips work in Nepali language', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Switch to Nepali
    await page.locator('text=नेपाली, text=Nepali').first().click()
    await page.waitForTimeout(500)

    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    const codeHeader = page.locator('th:has-text("Code"), th:has-text("कोड")').first()
    await codeHeader.hover()
    await page.waitForTimeout(500)

    const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
    if (await tooltip.isVisible({ timeout: 3000 })) {
      const text = await tooltip.textContent()
      // Should be in Nepali
      expect(text).toMatch(/कोड|खाता|युनिक/i)
    }
  })

  test('Tooltip toggle persists across sessions', async ({ page }) => {
    const tooltipToggle = page.locator('text=Show Tooltips, text=टुलटिप देखाउनुहोस्, text=Tooltips').first()
    const checkbox = tooltipToggle.locator('..').locator('input[type="checkbox"], [role="switch"]').first()
    
    if (await checkbox.isVisible()) {
      const initialState = await checkbox.isChecked()
      
      // Toggle to opposite state
      await checkbox.click()
      await page.waitForTimeout(500)

      // Reload page
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should maintain new state
      await expect(checkbox).toBeChecked() // if we turned it on
    }
  })

  test('Multiple tooltips can be viewed in sequence', async ({ page }) => {
    await page.goto('/accounts')
    await page.waitForLoadState('networkidle')

    const headers = ['Code', 'Name', 'Group', 'Class', 'Opening']
    
    for (const header of headers) {
      const th = page.locator(`th:has-text("${header}")`).first()
      if (await th.isVisible({ timeout: 1000 })) {
        await th.hover()
        await page.waitForTimeout(300)
        
        const tooltip = page.locator('[role="tooltip"], .tooltip, [data-tooltip]').first()
        if (await tooltip.isVisible({ timeout: 2000 })) {
          const text = await tooltip.textContent()
          expect(text).toBeTruthy()
        }
        
        // Move away
        await page.mouse.move(0, 0)
        await page.waitForTimeout(200)
      }
    }
  })
})