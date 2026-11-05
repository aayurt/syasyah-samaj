import { test as base } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'
const WEB_PORT = process.env.E2E_WEB_PORT || 5174

function parseSetCookie(header: string) {
  const parts = header.split(';').map((p) => p.trim())
  const eqIdx = parts[0].indexOf('=')
  const name = parts[0].slice(0, eqIdx).trim()
  const value = parts[0].slice(eqIdx + 1).trim()
  const cookie: { name: string; value: string; domain?: string; path?: string; secure?: boolean; sameSite?: string } = {
    name, value, domain: 'localhost', path: '/', secure: false, sameSite: 'Lax',
  }
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('Domain=')) cookie.domain = part.slice(7)
    else if (part.startsWith('Path=')) cookie.path = part.slice(5)
    else if (part.toLowerCase() === 'secure') cookie.secure = true
    else if (part.toLowerCase() === 'httponly') { /* keep httpOnly */ }
    else if (part.toLowerCase().startsWith('samesite=')) cookie.sameSite = part.slice(9).toLowerCase()
  }
  return cookie
}

/**
 * Base test fixture. Signs in via API, sets the session cookie in the browser
 * context (secure=false for HTTP CI), so authClient.useSession() resolves with
 * a valid session and the Shell renders. Falls back to UI login if the cookie
 * isn't accepted.
 */
export const test = base.extend<{}>({
  page: async ({ page, context, request }, use) => {
    // Step 1: API sign-in to get the session cookie
    try {
      const signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
        data: { email: EMAIL, password: PASSWORD },
        headers: { Origin: `http://localhost:${WEB_PORT}` },
      })
      if (signIn.ok()) {
        const setCookie = signIn.headers()['set-cookie']
        if (setCookie) {
          const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
          const parsed = cookies.map(parseSetCookie).filter((c) => c.name && c.value)
          if (parsed.length > 0) {
            await context.addCookies(
              parsed.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain!,
                path: c.path!,
                secure: false,
                sameSite: ((c.sameSite?.charAt(0).toUpperCase() + c.sameSite.slice(1)) as 'Lax') || 'Lax',
              })),
            )
          }
        }
      } else if (signIn.status() === 401) {
        // User doesn't exist — sign up first, then sign in
        await request.post(`${API_BASE}/api/auth/sign-up/email`, {
          data: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
          headers: { Origin: `http://localhost:${WEB_PORT}` },
        })
      }
    } catch {
      // API unavailable — will try UI login below
    }

    // Step 2: Navigate — cookie is sent via same-origin proxy
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for Login form or Shell
    await page
      .locator('input[type="email"], [data-testid="fiscal-year-select"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })

    // If login form is still visible, do UI login (browser handles cookie)
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
