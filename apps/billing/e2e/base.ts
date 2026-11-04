import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'

/**
 * Base test fixture that intercepts better-auth session endpoints so the app
 * shell renders with a valid admin session regardless of cookie/SameSite
 * behaviour across the SPA→API port boundary in CI.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('/api/auth/session')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
        })
        return
      }
      if (url.includes('/api/auth/get-session')) {
        await route.fulfill({ status: 200, body: '' })
        return
      }
      if (url.includes('/api/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], items: [], total: 0 }),
        })
        return
      }
      await route.continue()
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
