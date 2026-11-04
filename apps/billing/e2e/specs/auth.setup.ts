import { test as setup } from '@playwright/test'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const AUTH_STATE = join(root, '.auth', 'user.json')

setup('verify auth state exists', async ({ page }) => {
  if (!existsSync(AUTH_STATE)) {
    throw new Error(
      `Auth state not found at ${AUTH_STATE}. Run e2e/lightpanda-auth.mjs before E2E tests to generate it.`,
    )
  }

  // Navigate to the app — the pre-saved storage state (from lightpanda-auth.mjs)
  // carries the session cookie with secure=false, so Chromium sends it over
  // HTTP through the SPA proxy to the backend API. No SameSite/Secure issues.
  await page.goto('/')
  await page.waitForLoadState('networkidle')
})
