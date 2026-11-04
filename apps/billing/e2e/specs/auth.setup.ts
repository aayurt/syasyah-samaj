import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const AUTH_STATE = join(root, '.auth', 'user.json')

setup('authenticate as admin', async ({ page }) => {
  // Route-intercept better-auth session endpoints so the shell renders with
  // a valid admin session regardless of cookie/SameSite behaviour across
  // the SPA→API port boundary in CI.
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

  // If the login form is still visible (cookie didn't take), do UI login.
  const emailInput = page.locator('input[type="email"]')
  if (await emailInput.isVisible({ timeout: 2000 })) {
    await emailInput.fill(EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
  }

  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
