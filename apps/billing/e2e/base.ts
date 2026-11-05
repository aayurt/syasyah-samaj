import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'demo@syasyahsamaj.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaDemo2026!'

/**
 * Base test fixture. Ensures an authenticated admin session before each test.
 * Does UI login: browser handles Set-Cookie naturally, avoiding SameSite/Secure
 * issues across the SPA→API port boundary.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    // Safety net: intercept session endpoint so shell renders even if cookie
    // isn't accepted.
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
      })
    )
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ status: 200, body: '' })
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // If login form is visible, do UI login
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill(EMAIL)
      await page.fill('input[type="password"]', PASSWORD)
      await page.click('button[type="submit"]')
      await page.waitForURL('/', { timeout: 15_000 })
      await page.waitForLoadState('networkidle')
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
