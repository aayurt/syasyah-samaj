import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'

setup('authenticate as admin', async ({ page, request }) => {
  // Sign in via better-auth API to get the session cookie — bypasses React
  // hydration timing issues with the login form.
  const signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { Origin: `http://localhost:${process.env.E2E_WEB_PORT || 5174}` },
  })
  if (!signIn.ok()) {
    throw new Error(
      `API sign-in failed: ${signIn.status()} ${await signIn.text()}`,
    )
  }

  // Extract session cookie(s) from the sign-in response and set them in the
  // browser context so the SPA sees an authenticated session on first load.
  const setCookieHeader = signIn.headers()['set-cookie']
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    const parsed = cookies
      .map((c) => {
        const [nameValue, ...attrs] = c.split(';')
        const [name, value] = nameValue.split('=')
        const cookie: { name: string; value: string; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None' } = { name: name.trim(), value: value.trim() }
        for (const attr of attrs) {
          const [key, ...valParts] = attr.split('=')
          const val = valParts.join('=').trim()
          const k = key.trim().toLowerCase()
          if (k === 'domain') cookie.domain = val
          else if (k === 'path') cookie.path = val
          else if (k === 'httponly') cookie.httpOnly = true
          else if (k === 'secure') cookie.secure = true
          else if (k === 'samesite') cookie.sameSite = val as any
        }
        return cookie
      })
      .filter((c) => c.name && c.value)
    if (parsed.length > 0) {
      await page.context().addCookies(parsed)
    }
  }

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
