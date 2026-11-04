import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const API_BASE = process.env.API_URL || 'http://localhost:3100'

setup('authenticate as admin', async ({ page }) => {
  // Intercept the session endpoint so authClient.useSession() returns a valid
  // admin session immediately. This bypasses all React hydration / CORS /
  // cookie issues with the login form and better-auth API.
  await page.route(`${API_BASE}/api/auth/session`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
    }),
  )
  // Also handle the connectivity probe that useOfflineSession() makes when
  // there's no live session — return 200 so checking resolves to false.
  await page.route(`${API_BASE}/api/auth/get-session`, (route) =>
    route.fulfill({ status: 200, body: '' }),
  )

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(/डैशबोर्ड|Dashboard/).first().waitFor({ timeout: 15_000 })

  // Dismiss the first-run tour and persist both the session and that flag.
  await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
  // Drop stale settingsCache so suites read live data from the server.
  await page.evaluate(() => localStorage.removeItem('billing.settingsCache'))

  // Persist cookies / localStorage for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: join(root, '.auth', 'user.json') })
})
