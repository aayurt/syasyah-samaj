import { expect, test } from '@playwright/test'
import { dataset } from '../helpers/dataset'
import { Api } from '../helpers/api'

/**
 * S3 — Masters: parties + items. The masters-only seed created the 8 parties
 * and 8 items this suite verifies; it also creates and removes one extra of
 * each through the UI so the S4 voucher month sees a clean dataset.
 */
test.describe.serial('S3 — Masters', () => {
  test('S3.1 — seeded parties render with type filter chips', async ({ page }) => {
    await page.goto('/parties')
    for (const p of dataset.parties) {
      await expect(page.getByText(p.name).first()).toBeVisible({ timeout: 10_000 })
    }
    for (const chip of ['All', 'Customer', 'Vendor', 'Both']) {
      await expect(page.getByRole('button', { name: chip, exact: true }).first()).toBeVisible()
    }
  })

  test('S3.2/3.3 — add then delete a party through the UI', async ({ page, request }) => {
    await page.goto('/parties')
    await page.getByRole('button', { name: 'New party' }).click()
    const form = page.locator('form')
    await form.locator('input').first().fill('E2E Customer')
    // The party form has a Type select (Customer / Vendor / Both).
    const typeSelect = form.getByRole('combobox', { name: /Type|type/i }).first()
    if (await typeSelect.count()) {
      await typeSelect.selectOption({ label: 'Customer' })
    }
    await form.getByRole('button', { name: /Save|Create/ }).click()

    // The UI create is queued to the outbox first — poll until the server
    // copy exists (and the engine has mapped its local id), like S1.3/1.4.
    const api = new Api(request)
    await expect
      .poll(
        async () => !!(await api.findOne('parties', 'name', 'E2E Customer')),
        { timeout: 20_000, message: 'created party should reach the server' },
      )
      .toBeTruthy()
    await expect(page.getByText('E2E Customer').first()).toBeVisible({ timeout: 10_000 })

    // Resync so the local cache row maps to its server id, then delete
    // through the UI (Actions → Delete + confirm) to leave the dataset clean.
    await page.getByRole('button', { name: 'Resync' }).click()
    await expect(page.getByRole('button', { name: 'Resync' })).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr', { hasText: 'E2E Customer' }).first()
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('E2E Customer').first()).toHaveCount(0, { timeout: 10_000 })
  })

  test('S3.4 — seeded items render on Inventory', async ({ page }) => {
    await page.goto('/inventory')
    for (const it of dataset.items) {
      await expect(page.getByText(it.name).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('S3.5 — add an item through the UI', async ({ page, request }) => {
    await page.goto('/inventory')
    await page.getByRole('button', { name: 'New item' }).click()
    const form = page.locator('form')
    await form.locator('input').first().fill('E2E Item')
    await form.locator('input[type="number"]').first().fill('10') // stock
    await form.getByRole('button', { name: /Save|Create/ }).click()

    // The UI create is queued to the outbox first — poll until the server
    // copy exists so the suite is deterministic on re-runs.
    const api = new Api(request)
    await expect
      .poll(
        async () => !!(await api.findOne('items', 'name', 'E2E Item')),
        { timeout: 20_000, message: 'created item should reach the server' },
      )
      .toBeTruthy()
    await expect(page.getByText('E2E Item').first()).toBeVisible({ timeout: 10_000 })

    // Resync so the local cache row maps to its server id, then delete
    // through the UI (Actions → Delete + confirm) to leave the dataset clean.
    await page.getByRole('button', { name: 'Resync' }).click()
    await expect(page.getByRole('button', { name: 'Resync' })).toBeVisible({ timeout: 20_000 })
    const row = page.locator('tr', { hasText: 'E2E Item' }).first()
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('E2E Item').first()).toHaveCount(0, { timeout: 10_000 })
  })
})
