import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'

/**
 * Base test fixture. Ensures an authenticated admin session before each test.
 * Does UI login: browser handles Set-Cookie naturally, avoiding SameSite/Secure
 * issues across the SPA→API port boundary.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.goto('/')
    // Wait for the async session check to finish: either Login form or Shell appears.
    await page
      .locator('input[type="email"], [data-testid="fiscal-year-select"]')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })

    // If login form is visible, do UI login
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill(EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      // After sign-in, Shell renders — wait for fiscal year switcher.
      await page.locator('[data-testid="fiscal-year-select"]').waitFor({
        state: 'visible',
        timeout: 15_000,
      })
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
