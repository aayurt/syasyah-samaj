import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'
const WEB_PORT = process.env.E2E_WEB_PORT || 5174

/**
 * Base test fixture that ensures an authenticated session before each test.
 * Tries API sign-in + cookie first; falls back to UI login if the login form
 * is visible. Route-intercepts /api/auth/session as a safety net.
 */
export const test = base.extend<{}>({
  page: async ({ page, context, request }, use) => {
    // Safety net: intercept session endpoint
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

    // Try API sign-in to set the session cookie
    try {
      const signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
        data: { email: EMAIL, password: PASSWORD },
        headers: { Origin: `http://localhost:${WEB_PORT}` },
      })
      if (signIn.ok()) {
        const setCookie = signIn.headers()['set-cookie']
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
          const parsed = cookies.map((c) => {
            const [nv] = c.split(';')
            const eq = nv.indexOf('=')
            return {
              name: nv.slice(0, eq).trim(),
              value: nv.slice(eq + 1).trim(),
              url: `http://localhost:${WEB_PORT}`,
              secure: false,
              sameSite: 'Lax' as const,
            }
          }).filter((c) => c.name && c.value)
          if (cookies.length > 0 && parsed.length > 0) {
            await context.addCookies(parsed)
          }
        }
      }
    } catch {
      // API sign-in failed — will try UI login below
    }

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // If login form is visible, do UI login
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible({ timeout: 3000 })) {
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
