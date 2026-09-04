import { expect, test } from '@playwright/test'

/**
 * S0 — Shell & navigation (runs right after auth, before Settings).
 *
 * Covers the doc's S0.3 (fiscal-year baseline), S0.4 (sidebar accordions with
 * persisted state) and S0.5 (⌘K palette). S0.1 (servers) is handled by the
 * webServer block and S0.2 (login) by auth.setup.ts. Runs on the masters-only
 * seed, so the palette is exercised against seeded parties (documents don't
 * exist until suite 04 creates the voucher month).
 */
test.describe.serial('S0 — Shell & navigation', () => {
  const NAV_GROUPS = ['Bookkeeping', 'Masters', 'Inventory', 'Reports', 'Admin']

  /** Dismiss the first-run tour overlay and force the expanded sidebar. */
  async function resetShell(page: import('@playwright/test').Page) {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('tour-seen', '1')
      localStorage.setItem('sidebar-collapsed', '0')
    })
    await page.reload()
  }

  test('S0.3 — header shows the working fiscal year 2083-84', async ({ page }) => {
    await resetShell(page)
    const fy = page.locator('select[title*="Switch fiscal year"]')
    await expect(fy).toBeVisible({ timeout: 15_000 })
    // The seed created 2083-84 (2026-07-16 → 2027-07-15) as the working year.
    await expect(fy.locator('option:checked')).toContainText('2083-84')
    // Working-year badge on the switcher.
    await expect(page.locator('span[title="Working year"]')).toBeVisible()
  })

  test('S0.4 — sidebar groups collapse/expand, chevron rotates, state persists', async ({ page }) => {
    await resetShell(page)
    await expect(page.getByRole('button', { name: 'Bookkeeping', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // All titled groups start expanded.
    for (const g of NAV_GROUPS) {
      const h = page.getByRole('button', { name: g, exact: true })
      if ((await h.count()) === 0) continue // feature-gated group hidden
      await expect(h).toHaveAttribute('aria-expanded', 'true')
    }

    // Collapse Masters: aria-expanded flips, its items unmount, chevron rotates.
    const masters = page.getByRole('button', { name: 'Masters', exact: true })
    await masters.click()
    await expect(masters).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('link', { name: /Account Setup/ })).toHaveCount(0)
    await expect(masters.locator('svg.-rotate-90')).toBeVisible()

    // Persisted across reloads.
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Masters', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false', { timeout: 15_000 })

    // Re-open so later suites start from the default all-open layout.
    await page.getByRole('button', { name: 'Masters', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Masters', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  test('S0.5 — ⌘K palette finds a seeded party and routes to it', async ({ page }) => {
    await resetShell(page)
    // Open via the header search button (deterministic; ⌘K toggles it too).
    await page.getByTitle('Search & shortcuts (⌘K)').click()
    const input = page.getByPlaceholder('Search for transactions, parties & inventory…')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Annapurna')
    // Seed party — click the result to navigate.
    await page.locator('button', { hasText: 'Hotel Annapurna' }).first().click()
    await page.waitForURL('**/parties')
    await expect(page.getByText('Hotel Annapurna').first()).toBeVisible({ timeout: 15_000 })
  })
})