import { test as setup } from '@playwright/test'
import { E2E_BASE_URL } from '../base'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const AUTH_STATE = join(root, '.auth', 'user.json')

setup('auth state', async ({ page }) => {
  await page.goto(E2E_BASE_URL)
  await page.waitForLoadState('networkidle')
  mkdirSync(dirname(AUTH_STATE), { recursive: true })
  await page.context().storageState({ path: AUTH_STATE })
})
