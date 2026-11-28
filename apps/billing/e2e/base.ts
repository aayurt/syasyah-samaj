import { test as base } from '@playwright/test'

const E2E_BASE_URL = process.env.E2E_WEB_URL || 'http://localhost:5174'

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
    await page.goto(E2E_BASE_URL)
    await use(page)
  },
})

export { expect } from '@playwright/test'
export { E2E_BASE_URL }