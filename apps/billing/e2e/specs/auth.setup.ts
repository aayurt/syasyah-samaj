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
  let authOk = false

  // ── 1. Try API sign-in first (faster, bypasses React hydration) ────────
  try {
    const signIn = await request.post(`${API_BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { Origin: `http://localhost:${WEB_PORT}` },
    })
    if (signIn.ok()) {
      const setCookieHeader = signIn.headers()['set-cookie']
      if (setCookieHeader) {
        const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
        const parsed = cookies
          .map((c) => {
            const [nameValue, ...attrs] = c.split(';')
            const [name, value] = nameValue.split('=')
            const cookie: Record<string, unknown> = { name: name.trim(), value: value.trim() }
            for (const attr of attrs) {
              const [key, ...valParts] = attr.split('=')
              const val = valParts.join('=').trim()
              const k = key.trim().toLowerCase()
              if (k === 'domain') cookie.domain = val
              else if (k === 'path') cookie.path = val
              else if (k === 'httponly') cookie.httpOnly = true
              else if (k === 'secure') cookie.secure = true
              else if (k === 'samesite') cookie.sameSite = val
            }
            // Playwright requires url or path on each cookie
            if (!cookie.url && !cookie.path) {
              cookie.url = `http://localhost:${WEB_PORT}`
            }
            return cookie
          })
          .filter((c) => c.name && c.value)
        if (parsed.length > 0) {
          await page.context().addCookies(parsed)
          authOk = true
        }
      }
    }
  } catch {
    // API sign-in failed — fall through to UI login
  }

  // ── 2. Fall back to UI login if API didn't set cookies ─────────────────
  if (!authOk) {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /साइन इन|Sign in/ }).click()
  }

  await page.waitForURL('**/')
  await page.getByText(/डैशबोर्ड|Dashboard/).first().waitFor({ timeout: 15_000 })

  // Dismiss the first-run tour and persist both the session and that flag.
  await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
  // Drop stale settingsCache so suites read live data from the server.
  await page.evaluate(() => localStorage.removeItem('billing.settingsCache'))

  // Persist cookies for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: join(root, '.auth', 'user.json') })
})
