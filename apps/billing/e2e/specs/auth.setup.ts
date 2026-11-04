import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'
const WEB_PORT = process.env.E2E_WEB_PORT || 5174

setup('authenticate as admin', async ({ page, request }) => {
  async function attemptSignIn() {
    return await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
  }

  // Sign in via better-auth API to get the session cookie (best-effort;
  // route interception below guarantees the session regardless of cookie
  // / SameSite behaviour across the SPA→API port boundary).
  let signIn = await attemptSignIn()
  if (!signIn.ok()) {
    const signUp = await request.post(`${API_BASE}/api/auth/sign-up/email`, {
      data: { email: EMAIL, password: PASSWORD, name: 'E2E Admin' },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    if (signUp.ok() || signUp.status() === 409) {
      signIn = await attemptSignIn()
    }
    if (!signIn.ok()) {
      throw new Error(
        `API sign-in failed: ${signIn.status()} ${await signIn.text()}`,
      )
    }
  }

  // Best-effort: set the real session cookie so dependent suites that make
  // direct API calls (not via page) can authenticate.
  const setCookieHeader = signIn.headers()['set-cookie']
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    const parsed = cookies
      .flatMap((c) => c.split(/,\s*(?=[^=]+=)/))
      .map((c) => {
        const [nameValue] = c.split(';')
        const [name, value] = nameValue.split('=')
        return { name: name.trim(), value: value.trim(), url: API_BASE }
      })
      .filter((c) => c.name && c.value)
    if (parsed.length > 0) {
      await page.context().addCookies(parsed)
    }
  }

  // Guarantee the shell sees a valid session even if cookies don't survive
  // the cross-origin (SameSite=Lax) boundary between SPA port and API port.
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
  await page.getByText(/डैशबोर्ड|Dashboard/).first().waitFor({ timeout: 15_000 })

  // Dismiss the first-run tour and persist both the session and that flag.
  await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
  // Drop stale settingsCache so suites read live data from the server.
  await page.evaluate(() => localStorage.removeItem('billing.settingsCache'))

  // Persist cookies for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: join(root, '.auth', 'user.json') })
})
