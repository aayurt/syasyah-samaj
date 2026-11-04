import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'

/**
 * Base test fixture that mocks fetch at the page level to return a valid
 * admin session for /api/auth/session, so the shell renders regardless of
 * cookie/SameSite behaviour. Runs before any page script executes.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.addInitScript((email) => {
      ;(window as any).__sessionEmail = email
      const origFetch = window.fetch
      window.fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : String(input.url || input)
        if (url.includes('/api/auth/session')) {
          return new Response(
            JSON.stringify({ user: { email: window.__sessionEmail, role: 'admin' } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes('/api/auth/get-session')) {
          return new Response('', { status: 200 })
        }
        return origFetch(input, init)
      }
    }, EMAIL)
    await use(page)
  },
})

export { expect } from '@playwright/test'
