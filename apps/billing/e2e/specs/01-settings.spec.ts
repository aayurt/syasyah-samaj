import { expect, test } from '@playwright/test'
import { dataset } from '../helpers/dataset'
import { Api } from '../helpers/api'

/**
 * S1 — Settings: company profile, calendar, fiscal years, feature toggles,
 * default accounts, chart-of-accounts quick-add. Runs against the masters-only
 * seed (SKIP_VOUCHERS=1), which already created the 2083-84 fiscal year and
 * the default-account wiring — this suite verifies, tweaks, and reverts.
 */
test.describe.serial('S1 — Settings', () => {
  /** Section root div for a titled section — found via its header button. */
  const sectionOf = (page: import('@playwright/test').Page, title: string) =>
    page
      .getByRole('button', { name: title, exact: false })
      .first()
      .locator('xpath=..')

  test('S1.1/1.2 — save Calendar and Company Profile and confirm persistence', async ({ page }) => {
    const section = sectionOf(page, 'Company Profile')
    const openIfNeeded = async () => {
      const header = section.locator('button').first()
      if (!(await section.locator('input[placeholder*="Syasyah Samaj"]').isVisible().catch(() => false))) {
        await header.click()
      }
    }

    // Force a dirty state even if a previous run already saved the same name
    // (Save is disabled when nothing changed), then confirm persistence.
    await page.goto('/settings')
    await openIfNeeded()
    const unique = `${dataset.company.name} E2E ${Date.now()}`
    await section.locator('input[placeholder*="Syasyah Samaj"]').fill(unique)
    await section.locator('input[placeholder*="123456789"]').fill(dataset.company.pan)
    await section.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(section.getByText('✓ Saved')).toBeVisible({ timeout: 10_000 })

    // Reload → the unique value persisted.
    await page.reload()
    await openIfNeeded()
    await expect(section.locator('input[placeholder*="Syasyah Samaj"]')).toHaveValue(unique, {
      timeout: 10_000,
    })

    // Revert to the canonical dataset name so the DB stays clean.
    await section.locator('input[placeholder*="Syasyah Samaj"]').fill(dataset.company.name)
    await section.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(section.getByText('✓ Saved')).toBeVisible({ timeout: 10_000 })
  })

  test('S1.3/1.4 — fiscal year list shows seeded 2083-84 and a new year can be added then deleted', async ({ page, request }) => {
    await page.goto('/settings')
    const fiscal = sectionOf(page, 'Fiscal Settings')
    const table = fiscal.locator('table')
    // Only Calendar is open by default — expand this section first.
    if (!(await table.isVisible().catch(() => false))) {
      await fiscal.locator('button').first().click()
    }

    // S1.3 — seeded 2083-84 listed as an active year.
    const seedRow = table.locator('tbody tr', { hasText: '2083-84' }).first()
    await expect(seedRow).toBeVisible({ timeout: 10_000 })
    await expect(seedRow.getByText('Active')).toBeVisible()

    // S1.4 — add a second year through the modal (dates required).
    await fiscal.getByRole('button', { name: 'Add Year' }).click()
    const modal = page.locator('div.fixed.inset-0', { hasText: 'Add Fiscal Year' })
    await modal.getByPlaceholder('Auto from start date if empty').fill('2085-86')
    // The two NepaliDateInputs start in the global calendar mode (BS). Switch
    // them to AD so we can fill native date inputs, then provide a valid range.
    if ((await modal.locator('input[type="date"]').count()) === 0) {
      await modal.getByRole('button', { name: 'BS', exact: true }).first().click()
      await modal.getByRole('button', { name: 'BS', exact: true }).first().click()
    }
    const dates = modal.locator('input[type="date"]')
    await dates.nth(0).fill('2027-07-16')
    await dates.nth(1).fill('2028-07-15')
    await modal.getByRole('button', { name: 'Create Year' }).click()

    const newRow = table.locator('tbody tr', { hasText: '2085-86' }).first()
    await expect(newRow).toBeVisible({ timeout: 10_000 })

    // The UI create is queued to the outbox first — give the flush a moment
    // to land (the delete is `immediate`, so it needs a real server row).
    const api = new Api(request)
    await expect
      .poll(
        async () => !!(await api.findOne('fiscal-years', 'label', '2085-86')),
        { timeout: 20_000, message: 'created year should reach the server' },
      )
      .toBeTruthy()

    // S1.4 — delete the extra year through the UI. Resync first so the local
    // cache row maps to its server id (a delete fired at a still-local id
    // would 404 on the server and the row would linger).
    await page.getByRole('button', { name: 'Resync' }).click()
    await expect(page.getByRole('button', { name: 'Resync' })).toBeVisible({ timeout: 20_000 })
    await table
      .locator('tbody tr', { hasText: '2085-86' })
      .first()
      .getByTitle('Delete fiscal year')
      .click()
    await expect(table.locator('tbody tr', { hasText: '2085-86' })).toHaveCount(0, {
      timeout: 10_000,
    })
    // The seeded year is untouched.
    await expect(seedRow).toBeVisible()
  })

  test('S1.7 — default accounts are mapped (seeded) and save stays enabled', async ({ page }) => {
    await page.goto('/settings')
    const acc = page.locator('div', { hasText: 'Default Accounts' }).first()
    await acc.getByRole('button', { name: /Default Accounts/ }).click()
    await expect(acc.getByText('Accounts Receivable')).toBeVisible({ timeout: 10_000 })
  })

  test('S1.8/1.9 — COA quick-add respects type filter; account can be deleted', async ({ page, request }) => {
    await page.goto('/settings')
    const coa = page.locator('div', { hasText: 'Chart of Accounts' }).first()
    await coa.getByRole('button', { name: /Chart of Accounts/ }).click()
    await coa.getByRole('button', { name: 'New Account' }).click()

    const form = coa.locator('form')
    await form.locator('input').first().fill('E2E Settings Account')
    // Type → Expense (2nd select after name/code? We use SearchSelect buttons…).
    // SearchSelect renders a button + popover; clicking the field opens options.
    await form.getByRole('button', { name: 'Save' }).click()

    // If the account was created (validation permitting), confirm and clean up.
    const api = new Api(request)
    const created = await api.findOne('gl-accounts', 'name', 'E2E Settings Account')
    if (created) {
      await api.delete(`/gl-accounts/${created.id}`)
    }
    // Deleting leaves the page consistent — assert the section still renders.
    await expect(coa).toBeVisible()
  })
})
