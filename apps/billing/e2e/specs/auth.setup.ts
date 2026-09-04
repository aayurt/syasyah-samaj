import { test as setup } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dataset = JSON.parse(readFileSync(join(root, 'dataset.json'), 'utf8'))

const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Landing on Dashboard means the session is live.
  await page.waitForURL('**/')
  await expectDashboard(page)
  // Dismiss the first-run tour and persist both the session and that flag.
  await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
  // The landing page wrote billing.settingsCache to localStorage BEFORE the
  // S1.1 company save — snapshotting it would make every later suite serve a
  // stale company-less billing-settings from localStorage for the 5-min TTL
  // (which blocks the M1 setup gate on company). Drop it so suites read live
  // data from the server.
  await page.evaluate(() => localStorage.removeItem('billing.settingsCache'))
  // Persist cookies for all dependent suites.
  mkdirSync(join(root, '.auth'), { recursive: true })
  await page.context().storageState({ path: join(root, '.auth', 'user.json') })
})

async function expectDashboard(page: import('@playwright/test').Page) {
  await page.getByText('Dashboard', { exact: true }).first().waitFor({ timeout: 15_000 })
}
