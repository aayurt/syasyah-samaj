import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'

/**
 * Base test fixture. Overrides window.fetch to return a mock admin session
 * for /api/auth/session so useOfflineSession() resolves immediately with a
 * valid session. Falls back to UI login if the shell still doesn't render.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    // Intercept auth endpoints at the fetch level so better-auth's useSession
    // resolves with a valid admin session without any network round-trip.
    await page.addInitScript((email) => {
      const origFetch = window.fetch
      window.fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : String(input)
        if (url.includes('/api/auth/session')) {
          return new Response(
            JSON.stringify({ data: { session: {}, user: { email, role: 'admin' } } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/api/auth/get-session')) {
          return new Response(JSON.stringify({ data: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        return origFetch(input, init)
      }
    }, EMAIL)

    await page.goto('/')
    // Wait for Login form or Shell to render (session check is async).
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
      await page.locator('[data-testid="fiscal-year-select"]').waitFor({
        state: 'visible',
        timeout: 15_000,
      })
    }

    await use(page)
  },
})

export { expect } from '@playwright/test'
