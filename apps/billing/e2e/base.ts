import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'

/**
 * Base test fixture that intercepts better-auth session endpoints so the app
 * shell renders with a valid admin session. Used by all dependent E2E specs.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
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
    await use(page)
  },
})

export { expect } from '@playwright/test'
