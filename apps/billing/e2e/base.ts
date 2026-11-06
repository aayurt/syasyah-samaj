import { test as base } from '@playwright/test'

/**
 * Base test fixture. Sets localStorage.__e2e_bypass__ via addInitScript so
 * useOfflineSession() returns a mock admin session immediately on page load —
 * no auth cookies, no API round-trips, no SameSite issues.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('__e2e_bypass__', '1')
    })
    await page.goto('/')
    await page.locator('[data-testid="fiscal-year-select"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
