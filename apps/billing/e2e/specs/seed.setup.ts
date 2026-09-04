import { test as setup } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * 00-seed — prepare the database for the journey.
 *
 * Bootstraps a fresh DB (default tenant + admin, via scripts/bootstrap.mjs)
 * and seeds the masters (SKIP_VOUCHERS=1). Runs after the webServer boots the
 * API instance and before auth, so every suite starts from a known state.
 */
setup('bootstrap + seed masters-only dataset', () => {
  const r = spawnSync(process.execPath, [join(here, '..', 'scripts', 'bootstrap.mjs')], {
    env: process.env,
    stdio: 'inherit',
  })
  if (r.status !== 0) {
    throw new Error(`e2e bootstrap + seed failed (exit ${r.status})`)
  }
})