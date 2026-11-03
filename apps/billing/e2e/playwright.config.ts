import { defineConfig, devices } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const AUTH_STATE = join(here, '.auth', 'user.json')

/**
 * Playwright config for E2E tests.
 * 
 * CI runs: Fully parallel, multiple workers
 * Jules runs: Distributed across parallel workers
 * Local runs: Sequential for debugging
 */
const isCI = !!process.env.CI
const isJules = !!process.env.JULES_RUN_ID
const workers = isCI ? 4 : (isJules ? 1 : 1)
const fullyParallel = isCI || isJules

const API_PORT = Number(process.env.E2E_API_PORT || 3100)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174)
const API_URL = `http://localhost:${API_PORT}`
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './specs',
  workers,
  fullyParallel,
  retries: isCI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: join(here, '..', 'test-results', 'html'), open: 'never' }],
    ['json', { outputFile: join(here, '..', 'test-results', 'results.json') }],
    ['junit', { outputFile: join(here, '..', 'test-results', 'results.xml') }],
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: join(here, '..', 'test-results', 'artifacts'),
  
  // Global setup/teardown
  globalSetup: join(here, 'global-setup.ts'),
  globalTeardown: join(here, 'global-teardown.ts'),

  // Start both API (Next.js) and Web (Vite) servers
  webServer: [
    {
      command: `pnpm --dir ../../ dev`,
      cwd: '.',
      env: {
        ...(process.env.E2E_DATABASE_URI
          ? { DATABASE_URI: process.env.E2E_DATABASE_URI }
          : {}),
        PORT: String(API_PORT),
        NODE_OPTIONS: '--no-deprecation',
        BETTER_AUTH_URL: WEB_URL,
        NEXT_PUBLIC_SERVER_URL: WEB_URL,
      },
      url: `${API_URL}/api/users`,
      timeout: 180_000,
      reuseExistingServer: !isCI && !isJules,
    },
    {
      command: `pnpm dev --port ${WEB_PORT} --strictPort`,
      cwd: '..',
      env: { E2E_API_TARGET: API_URL, VITE_API_URL: API_URL },
      url: WEB_URL,
      timeout: 60_000,
      reuseExistingServer: !isCI && !isJules,
    },
  ],

  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Setup projects (run once)
    { name: 'setup-seed', testMatch: /seed\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'setup-auth',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['setup-seed'],
      use: { ...devices['Desktop Chrome'] },
    },

    // Test projects (parallel in CI/Jules)
    {
      name: 'shell',
      testMatch: /00-shell\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'settings',
      testMatch: /01-settings\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'accounts',
      testMatch: /02-accounts\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'masters',
      testMatch: /03-masters\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'vouchers',
      testMatch: /04-vouchers\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'journal',
      testMatch: /05-journal\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'reports',
      testMatch: /06-reports\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'offline',
      testMatch: /07-offline\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-storage',
      testMatch: /08-desktop-storage\.spec\.ts/,
      dependencies: ['setup-auth'],
    },
    {
      name: 'spa-sqlite',
      testMatch: /09-spa-sqlite\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'membership',
      testMatch: /10-membership\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'defects',
      testMatch: /90-defects\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },

    // New test projects for Phase 4 requirements
    {
      name: 'tenant-selector',
      testMatch: /tenant-selector\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'coa-table',
      testMatch: /coa-table\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'import-export',
      testMatch: /import-export\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'language',
      testMatch: /language\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'tooltips',
      testMatch: /tooltips\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Desktop Chrome'] },
    },

    // Mobile viewport
    {
      name: 'mobile',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup-auth'],
      use: { storageState: AUTH_STATE, ...devices['Pixel 5'] },
    },
  ],
})