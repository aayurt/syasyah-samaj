import { test as base } from '@playwright/test'

/**
 * Base test fixture. Sets localStorage.__e2e_bypass__ before app hydration
 * so useOfflineSession() returns a mock admin session immediately — no auth
 * cookies, no API round-trips, no SameSite issues.
 */
export const test = base.extend<{}>({
  page: async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      window.localStorage.setItem('__e2e_bypass__', '1')
    })
    await page.reload()
    await page.locator('[data-testid="fiscal-year-select"]').waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
