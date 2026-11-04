import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'

/**
 * Base test fixture that intercepts all API requests so the app shell renders
 * with a valid admin session regardless of cookie/SameSite behaviour across
 * the SPA→API port boundary in CI.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.route(/.*\/api\/auth\/session/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
      })
    )
    await page.route(/.*\/api\/auth\/get-session/, (route) =>
      route.fulfill({ status: 200, body: '' })
    )
    await page.route(/.*\/api\/.*/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], items: [], total: 0 }),
      })
    )
    await use(page)
  },
})

export { expect } from '@playwright/test'
