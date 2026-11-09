import { expect, test } from '../base'
import { Api } from '../helpers/api'

/**
 * Reconciliation (Phase 6): import a bank statement for a bank account,
 * reconcile it, and verify the match/unmatched summary is produced.
 */
test.describe.serial('Reconciliation', () => {
  test('T1 — reconcile a bank statement with no opening balance', async ({ page, request }) => {
    const api = new Api(request)
    const res = await api.get<{ docs: { id: number; name: string; class: string }[] }>('/gl-accounts', {
      depth: 0,
    })
    const accounts = res.docs.filter((a) => a.class === 'bank')
    const account = accounts[0]
    expect(account, 'no bank account found in seed').toBeTruthy()

    await page.goto('/bank-reconciliation')
    await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible({ timeout: 15_000 })

    const select = page.getByLabel('Select Bank Account').first()
    await expect(select).toBeVisible({ timeout: 10_000 })
    await select.click()
    await page.getByRole('option', { name: account.name }).first().click()

    const csv = 'date,description,reference,amount\n2026-08-01,Cash deposit,REF001,50000\n2026-08-05,Rent payment,CHQ042,-25000'
    await page.getByPlaceholder(/date,description,reference,amount/i).fill(csv)
    await page.getByRole('button', { name: 'Import Statement' }).click()
    await expect(page.getByText(/imported \d+ rows/i)).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Reconcile' }).click()
    await expect(page.getByText(/Reconciliation Result/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/All statement rows matched/i)).toBeVisible({ timeout: 15_000 })
  })
})
