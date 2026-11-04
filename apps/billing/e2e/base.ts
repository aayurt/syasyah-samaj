import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'

/**
 * Base test fixture that intercepts better-auth session endpoints so the app
 * shell renders with a valid admin session regardless of cookie/SameSite
 * behaviour across the SPA→API port boundary in CI. All other API calls
 * continue to the real server.
 */
export const test = base.extend<{}>({
  context: async ({ context }, use) => {
    await context.route((route) => route.request().url().includes('/api/auth/session'), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
      })
    )
    await context.route((route) => route.request().url().includes('/api/auth/get-session'), (route) =>
      route.fulfill({ status: 200, body: '' })
    )
    await use(context)
  },
})

export { expect } from '@playwright/test'
