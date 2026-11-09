import { expect, test } from '../base'
import { Api } from '../helpers/api'

/**
 * Setup guard (Phase 1 preflight): the M1 setup gate must block voucher
 * posting until company, fiscal year, chart of accounts and default accounts
 * are complete, and must clear once they are.
 */
test.describe.serial('Setup guard', () => {
  test('T1 — Save & post is enabled when setup is complete (seeded)', async ({ page }) => {
    await page.goto('/vouchers/new/journal-voucher')
    const post = page.getByRole('button', { name: 'Save & post' })
    await expect(post).toBeVisible()
    await expect(post).not.toBeDisabled()
  })

  test('T2 — clearing a default account blocks posting; restoring clears the guard', async ({ page, request }) => {
    const api = new Api(request)
    const settings = await api.get<{ receivableAccount: number | null }>('/globals/billing-settings')
    const original = settings.receivableAccount

    // Clear a required default account → setup incomplete → posting blocked.
    await api.patch('/globals/billing-settings', { receivableAccount: null })
    await page.goto('/vouchers/new/journal-voucher')
    await expect(page.getByRole('button', { name: 'Save & post' })).toBeDisabled()

    // Restore → guard clears.
    await api.patch('/globals/billing-settings', { receivableAccount: original })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Save & post' })).not.toBeDisabled()
  })
})
