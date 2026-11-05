import { test as base } from '@playwright/test'

/**
 * Base test fixture. App.tsx bypasses auth when VITE_BYPASS_AUTH=true
 * (set at build time in CI), so the shell renders with a mock admin session.
 * Route-intercepts /api/auth/session as a safety net.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { email: 'e2e@test.com', role: 'admin' } }),
      })
    )
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ status: 200, body: '' })
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await use(page)
  },
})

export { expect } from '@playwright/test'
