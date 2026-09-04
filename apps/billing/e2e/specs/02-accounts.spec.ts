import { expect, test } from '@playwright/test'
import { dataset } from '../helpers/dataset'
import { Api } from '../helpers/api'

/**
 * S2 — Account setup (Chart of Accounts). Verifies the seeded chart,
 * the type→group filter (Accounts.tsx form), creates an account through the
 * UI, then deletes it so the dataset stays deterministic for S3+.
 */
test.describe.serial('S2 — Account setup', () => {
  test('S2.1 — seeded chart renders grouped by type', async ({ page }) => {
    await page.goto('/accounts')
    await expect(page.getByRole('heading', { name: 'Chart of Accounts' })).toBeVisible()
    // The page groups accounts into type sections (Assets, Liabilities, …)
    // with the account-group shown as a column. Empty groups (e.g. Fixed
    // Assets) contain no accounts, so they render only in the create form's
    // Group dropdown — assert the type sections and their row counts instead.
    const section = (label: string, count: number) =>
      page
        .locator('div.rounded-lg.border', { hasText: label })
        .filter({ hasText: String(count) })
        .first()
    const byType: Record<string, number> = {
      Assets: 5,
      Liabilities: 3,
      Equity: 1,
      Income: 3,
      Expenses: 8,
    }
    for (const [label, count] of Object.entries(byType)) {
      await expect(section(label, count)).toBeVisible({ timeout: 10_000 })
    }
    // A known seeded account and a populated group cell (rendered as
    // "Group (code)", e.g. "Current Assets (1)").
    await expect(page.getByText('Cash in Hand').first()).toBeVisible()
    await expect(page.getByText('Current Assets (1)').first()).toBeVisible()
    // The full chart is present: 20 of 20 rows.
    await expect(page.getByText('20 of 20')).toBeVisible()
  })

  test('S2.2/2.3 — group dropdown filters by selected type', async ({ page }) => {
    await page.goto('/accounts')
    await page.getByRole('button', { name: 'New account' }).click()
    const form = page.locator('form')
    // Selects are Type, Class, Group (each wrapped in a labelled field).
    const typeSelect = form.getByRole('combobox', { name: 'Type' })
    await typeSelect.selectOption({ label: 'Expenses' })
    const groupSelect = form.getByRole('combobox', { name: 'Group' })
    const expenseGroups = dataset.accounts.groups
      .filter((g) => g.type === 'expense')
      .map((g) => g.name)
    // Groups load over the network on a cold cache — wait for the empty
    // placeholder to disappear before reading options (a plain read can race
    // first paint; auto-waiting on the placeholder handles it).
    await expect(groupSelect.locator('option[value="__no-groups__"]')).toHaveCount(0)
    const options = await groupSelect.locator('option').allInnerTexts()
    for (const g of expenseGroups) expect(options.join(' | ')).toContain(g)
    // Assets must not appear under Expenses.
    for (const g of dataset.accounts.groups.filter((x) => x.type === 'asset')) {
      expect(options.join(' | ')).not.toContain(g.name)
    }
    // S2.3 — switching Type back to an asset clears a picked expense group.
    await groupSelect.selectOption({ label: 'Indirect Expenses' })
    await typeSelect.selectOption({ label: 'Assets' })
    await expect(groupSelect).toHaveValue('')
    await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {})
  })

  test('S2.4/2.5/2.6 — create via UI (type→group respected), verify, delete', async ({ page, request }) => {
    await page.goto('/accounts')
    await page.getByRole('button', { name: 'New account' }).click()
    const form = page.locator('form')
    await form.locator('input').first().fill('E2E Rent Test') // name
    await form.getByRole('combobox', { name: 'Type' }).selectOption({ label: 'Expenses' })
    await form.getByRole('combobox', { name: 'Group' }).selectOption({ label: 'Indirect Expenses' })
    await form.getByRole('spinbutton', { name: 'Opening balance' }).fill('0')
    await form.getByRole('button', { name: /Save/ }).click()

    // The UI create is queued to the outbox first — poll until the server
    // copy exists (and the engine has mapped its local id), like S1.3/1.4.
    const api = new Api(request)
    await expect
      .poll(
        async () => !!(await api.findOne('gl-accounts', 'name', 'E2E Rent Test')),
        { timeout: 20_000, message: 'created account should reach the server' },
      )
      .toBeTruthy()
    const created = await api.findOne('gl-accounts', 'name', 'E2E Rent Test')
    expect(created!.type).toBe('expense')

    // CSV path is hard to assert headlessly (download) — verify row exists.
    await expect(page.getByText('E2E Rent Test').first()).toBeVisible({ timeout: 10_000 })

    // Resync so the local cache row maps to its server id, then delete
    // through the UI (Actions → Delete + confirm) to leave the dataset clean.
    await page.getByRole('button', { name: 'Resync' }).click()
    await expect(page.getByRole('button', { name: 'Resync' })).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr', { hasText: 'E2E Rent Test' }).first()
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('E2E Rent Test').first()).toHaveCount(0, { timeout: 10_000 })
  })
})
