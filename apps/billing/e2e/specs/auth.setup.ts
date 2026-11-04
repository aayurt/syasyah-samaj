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
  // UI-based login: browser handles Set-Cookie naturally, avoiding
  // SameSite/Secure cookie issues across the SPA→API port boundary.
  await page.goto('/login')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // After sign-in, better-auth redirects to '/'. Wait for the shell to
  // render (session cookie is now set by the browser).
  await page.waitForURL('/', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  // Persist cookies + localStorage for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
