import { test as base } from '@playwright/test'

/**
 * Base test fixture. Sets window.__E2E_BYPASS_AUTH__ before navigation so
 * App.tsx renders the Shell with a mock admin session directly — no auth
 * cookies, no API round-trips, no SameSite issues.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      ;(window as any).__E2E_BYPASS_AUTH__ = true
    })
    await page.goto('/')
    // Wait for Shell to render — fiscal year switcher is in the header.
    await page.locator('[data-testid="fiscal-year-select"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
