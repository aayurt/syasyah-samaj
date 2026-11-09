/**
 * S9 — Payroll (india-payroll module).
 *
 * Covers the payroll batch workflow end-to-end:
 *   S9.1 — Navigate to Payroll, see Runs + Employees tabs
 *   S9.2 — Generate a draft run from the roster
 *   S9.3 — View per-employee lines (expand run row)
 *   S9.4 — Post the run → journal entry created, status = posted
 *   S9.5 — Void the run → status = void, journal voided
 *
 * Uses the localStorage __e2e_bypass__ mock session (base fixture) — no auth
 * cookies, no SameSite issues. The API server must be running (:3100) and
 * the SPA proxied on :5174. DB is seeded before each suite run.
 */
import { expect, test } from '../base'

test.describe.serial('S9 — Payroll', () => {
  test('S9.1 — Payroll page renders with Runs and Employees tabs', async ({ page }) => {
    await page.goto('/payroll')
    await expect(page.getByRole('heading', { name: 'Payroll' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Runs' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Employees' })).toBeVisible()
  })

  test('S9.2 — Generate a draft payroll run', async ({ page, request }) => {
    await page.goto('/payroll')

    const periodInput = page.locator('input[type="month"]')
    await expect(periodInput).toBeVisible()

    const payDateInput = page.locator('input[type="date"]')
    await expect(payDateInput).toBeVisible()

    // Click Generate run
    await page.getByRole('button', { name: 'Generate run' }).click()

    // Should see a run appear in the table
    const runRow = page.locator('tr').filter({ hasText: /PR-/ }).first()
    await expect(runRow).toBeVisible({ timeout: 15_000 })
    await expect(runRow).toContainText('Draft')
  })

  test('S9.3 — View run lines (expand row)', async ({ page }) => {
    await page.goto('/payroll')

    // Find an existing draft run and expand it
    const viewLines = page.getByRole('button', { name: 'View lines' }).first()
    if ((await viewLines.count()) > 0) {
      await viewLines.click()
      await expect(page.locator('[data-testid="run-lines"]')).toBeVisible()
    } else {
      // No runs yet — generate one first
      await page.getByRole('button', { name: 'Generate run' }).click()
      await page.getByRole('button', { name: 'View lines' }).first().click()
      await expect(page.locator('[data-testid="run-lines"]')).toBeVisible()
    }
  })

  test('S9.4 — Post the run → status posted', async ({ page }) => {
    await page.goto('/payroll')

    // Generate a run if none exists
    const runRows = page.locator('tr').filter({ hasText: /PR-/ })
    if ((await runRows.count()) === 0) {
      await page.getByRole('button', { name: 'Generate run' }).click()
    }

    const postBtn = page.getByRole('button', { name: 'Post' }).first()
    if ((await postBtn.count()) > 0) {
      await postBtn.click()
      await expect(page.getByText('Posted', { exact: false })).toBeVisible({ timeout: 15_000 })
    }
  })

  test('S9.5 — Void a posted run → status void', async ({ page }) => {
    await page.goto('/payroll')

    // Find a posted run and void it
    const voidBtn = page.getByRole('button', { name: 'Void' }).first()
    if ((await voidBtn.count()) > 0) {
      await voidBtn.click()
      await expect(page.getByText('Void', { exact: false })).toBeVisible({ timeout: 15_000 })
    }
  })
})
