import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const AUTH_STATE = join(root, '.auth', 'user.json')

setup('authenticate as admin', async ({ page }) => {
  // Route-intercept better-auth session endpoints so the shell renders with
  // a valid admin session regardless of cookie/SameSite behaviour.
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { email: 'aayurtshrestha@gmail.com', role: 'admin' } }),
    })
  )
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({ status: 200, body: '' })
  )

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Persist (empty) storage state for dependent suites.
  // Auth is handled by route interception in base.ts fixture.
  mkdirSync(dirname(AUTH_STATE), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
