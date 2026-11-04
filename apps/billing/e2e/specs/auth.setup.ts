import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'
const API_BASE = process.env.API_URL || 'http://localhost:3100'
const WEB_PORT = process.env.E2E_WEB_PORT || 5174
const AUTH_STATE = join(root, '.auth', 'user.json')

setup('authenticate as admin', async ({ page, request }) => {
  // Intercept better-auth session endpoint as a fallback so the shell
  // renders even if the session cookie isn't accepted over HTTP.
  await page.route(/.*\/api\/auth\/session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: EMAIL, role: 'admin' } }),
    })
  )
  await page.route(/.*\/api\/auth\/get-session/, (route) =>
    route.fulfill({ status: 200, body: '' })
  )

  // Navigate to the app — if a valid session cookie exists, the shell
  // renders; otherwise the login page shows and we do UI-based login.
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const emailInput = page.locator('input[type="email"]')
  if (await emailInput.isVisible({ timeout: 2000 })) {
    // UI-based login: browser handles Set-Cookie naturally
    await emailInput.fill(EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15_000 })
    await page.waitForLoadState('networkidle')
  }

  // Persist cookies + localStorage for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
