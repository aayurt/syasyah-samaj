import { expect, test } from '../base'
import { Api } from '../helpers/api'
import { dataset } from '../helpers/dataset'

/**
 * Default accounts (Phase 1 P6): all 14 posting roles must be mapped to
 * existing accounts, and clearing a required role must block posting.
 */
test.describe.serial('Default accounts', () => {
  test('P6.1 — all default account roles are mapped to existing accounts', async ({ request }) => {
    const api = new Api(request)
    const settings = await api.get<Record<string, number | null>>('/globals/billing-settings')

    const roles = Object.keys(dataset.accounts.defaultRoles)
    for (const role of roles) {
      const id = settings[role]
      expect(id, `${role} is not mapped`).not.toBeNull()
      expect(id, `${role} is not mapped`).not.toBeUndefined()

      // The mapped account must exist in the Chart of Accounts.
      const account = await api.findOne('gl-accounts', 'id', Number(id))
      expect(account, `${role} account id ${id} does not exist`).toBeTruthy()
    }
  })

  test('P6.2 — clearing the receivable default account blocks posting', async ({ page, request }) => {
    const api = new Api(request)
    const settings = await api.get<{ receivableAccount: number | null }>('/globals/billing-settings')
    const original = settings.receivableAccount!

    await api.patch('/globals/billing-settings', { receivableAccount: null })
    await page.goto('/vouchers/new/journal-voucher')
    await expect(page.getByRole('button', { name: 'Save & post' })).toBeDisabled()

    await api.patch('/globals/billing-settings', { receivableAccount: original })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Save & post' })).not.toBeDisabled()
  })
})
