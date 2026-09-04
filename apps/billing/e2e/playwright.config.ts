import { defineConfig, devices } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const AUTH_STATE = join(here, '.auth', 'user.json')

/**
 * Sequential E2E suite for the billing SPA.
 *
 * Run order is enforced with Playwright project *dependencies* — each suite
 * only starts after the previous one fully passed, so the journey is a strict
 * chain: 00-auth → 00-shell → 01-settings → 02-accounts → 03-masters →
 * 04-vouchers → 05-journal → 06-reports → 07-offline.
 *
 * Fully self-contained: this config STARTS the whole stack from scratch on
 * dedicated ports and tears it down after the run — it never reuses a running
 * dev server, and never touches whatever is on :3000/:5173.
 *
 *   - Payload (Next dev) on :3100  (override with E2E_API_PORT)
 *   - Billing SPA (Vite)  on :5174  (override with E2E_WEB_PORT)
 *
 * The API instance uses its own build dir (.next-e2e) so it can run at the
 * same time as the normal `pnpm dev` server. The SPA reaches the API through
 * its Vite proxy, pointed at the API port via E2E_API_TARGET.
 *
 * DB: defaults to the DATABASE_URI in the repo .env (shared with local dev —
 * seed it masters-only first, see the run guide in docs/E2E_TEST_CASES.md).
 * CI can isolate with E2E_DATABASE_URI; the seed command in the guide also
 * accepts BILLING_API to target this instance.
 */
const API_PORT = Number(process.env.E2E_API_PORT || 3100)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174)
const API_URL = `http://localhost:${API_PORT}`
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './specs',
  // Strict sequential journey — a single worker, no parallel files.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Boot everything fresh — no reuseExistingServer anywhere.
  webServer: [
    {
      // Payload (Next dev) on :3100, own build dir, dev-mode schema push.
      command: `npx next dev -p ${API_PORT}`,
      cwd: '../../..', // repo root — the Next app that hosts Payload
      env: {
        ...(process.env.E2E_DATABASE_URI
          ? { DATABASE_URI: process.env.E2E_DATABASE_URI }
          : {}),
        NEXT_DIST_DIR: '.next-e2e',
        NODE_OPTIONS: '--no-deprecation',
        // better-auth validates the Origin header against this — it must be the
        // SPA origin the browser actually posts from (via the Vite proxy).
        BETTER_AUTH_URL: `${WEB_URL}/`,
        NEXT_PUBLIC_SERVER_URL: `${WEB_URL}/`,
      },
      // A real API path: `/api` (exact) hits the 404/next-international path.
      url: `${API_URL}/api/users`,
      timeout: 180_000,
    },
    {
      // Billing SPA on :5174, proxying /api to the API instance above.
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: '..', // apps/billing — the Vite app
      env: { E2E_API_TARGET: API_URL },
      url: WEB_URL,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 00 — bootstrap + masters-only seed (fresh-DB aware, idempotent).
    { name: '00-seed', testMatch: /seed\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    // 00a — login once, persist session for every suite.
    {
      name: '00-auth',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['00-seed'],
      use: { ...devices['Desktop Chrome'] },
    },
    // 00b — S0 shell: FY baseline, sidebar accordions, ⌘K palette.
    {
      name: '00-shell',
      testMatch: /00-shell\.spec\.ts/,
      dependencies: ['00-auth'],
      use: { storageState: AUTH_STATE },
    },
    // 01 — Settings: calendar, company profile, fiscal years, defaults, COA quick-add.
    {
      name: '01-settings',
      testMatch: /01-settings\.spec\.ts/,
      dependencies: ['00-shell'],
      use: { storageState: AUTH_STATE },
    },
    // 02 — Account setup: seeded chart + type→group filter + create/CSV/delete.
    {
      name: '02-accounts',
      testMatch: /02-accounts\.spec\.ts/,
      dependencies: ['01-settings'],
      use: { storageState: AUTH_STATE },
    },
    // 03 — Masters: parties + items.
    {
      name: '03-masters',
      testMatch: /03-masters\.spec\.ts/,
      dependencies: ['02-accounts'],
      use: { storageState: AUTH_STATE },
    },
    // 04 — The 13-voucher sequential month (core). UI reps + API bulk.
    {
      name: '04-vouchers',
      testMatch: /04-vouchers\.spec\.ts/,
      dependencies: ['03-masters'],
      use: { storageState: AUTH_STATE },
    },
    // 05 — Journal list numbers + drill-down modal.
    {
      name: '05-journal',
      testMatch: /05-journal\.spec\.ts/,
      dependencies: ['04-vouchers'],
      use: { storageState: AUTH_STATE },
    },
    // 06 — Reports acceptance (expected outputs table).
    {
      name: '06-reports',
      testMatch: /06-reports\.spec\.ts/,
      dependencies: ['05-journal'],
      use: { storageState: AUTH_STATE },
    },
    // 07 — Offline draft → reconnect → single row (no dupes).
    {
      name: '07-offline',
      testMatch: /07-offline\.spec\.ts/,
      dependencies: ['06-reports'],
      use: { storageState: AUTH_STATE },
    },
  ],
})