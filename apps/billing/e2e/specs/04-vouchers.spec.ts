import { expect, test } from '@playwright/test'
import { Api } from '../helpers/api'
import { dataset } from '../helpers/dataset'
import type { VoucherSpec } from '../helpers/dataset'
import { assertSinglePosted, createVoucherViaApi, createVoucherViaUi, resolveMasters } from '../helpers/voucherFlow'
import { expectVoucherRow } from '../helpers/ui'
import { expectMoney, money } from '../helpers/money'

/**
 * S4 — The sequential voucher month (core). Order matters: each voucher is
 * created and posted in dataset order, exactly as the E2E_TEST_CASES doc
 * specifies, so numbering is deterministic per doc type.
 *
 * Hybrid (per approved design):
 *   - UI reps (full form): step 1 Journal Entry, step 10 Petty Cash
 *   - the other 11 vouchers go through the same API the UI posts to
 *     (POST /documents → /documents/:id/post), keeping the loop fast.
 * Every voucher is then asserted in the UI list: exactly one row, correct
 * number, correct gross amount.
 */
test.describe.serial('S4 — the 13-voucher sequential month', () => {
  // Run the whole month inside one test so the journey is strictly ordered
  // even if a browser reload drops in-flight state between steps.
  test('post the month in order and verify every row', async ({ page, request }) => {
    const api = new Api(request)
    const resolve = await resolveMasters(api)

    // S4.16 void test will need SI-2083-84-0003 (Thamel, step 11) — remember it.
    const uiSteps = new Set([1, 10]) // step numbers driven through the form UI

    for (const spec of dataset.vouchers) {
      const label = `S4.${String(spec.step).padStart(2, '0')} ${spec.docType} → ${spec.expectedNumber}`
      await test.step(label, async () => {
        let number = ''
        if (uiSteps.has(spec.step)) {
          await createVoucherViaUi(page, spec)
          // The UI posts through the sync engine; the row appears once the
          // outbox flush assigns the server number.
          await expectVoucherRow(page, spec.expectedNumber!)
          number = spec.expectedNumber!
        } else {
          // Credit note (step 9) references the step-6 invoice by narration.
          let referenceToId: number | undefined
          if (spec.referenceNarration) {
            const ref = await api.findOne('documents', 'narration', spec.referenceNarration)
            referenceToId = ref ? Number(ref.id) : undefined
          }
          const res = await createVoucherViaApi(api, spec, resolve, referenceToId)
          number = res.number
          if (spec.expectedNumber) expect(number).toBe(spec.expectedNumber)
          await expectVoucherRow(page, spec.expectedNumber!)
        }

        // — regression checks per row —
        await test.step(`${spec.expectedNumber} appears once (no duplicate)`, async () => {
          const count = await (await import('../helpers/ui')).voucherRowCount(page, number)
          expect(count).toBe(1)
        })
      })
    }

    // Amount regression: the amounts on the list must be non-zero and correct.
    await page.goto('/vouchers')
    for (const spec of dataset.vouchers) {
      const row = page.locator('tr', { hasText: spec.expectedNumber! })
      await expect(row).toHaveCount(1)
      if (spec.expectedGross) {
        const cells = row.locator('td')
        // Columns: checkbox, Date, Updated, Number, Type, Party, Amount,
        // Status, Payment, Voided, Actions → Amount is index 6.
        const amt = await cells.nth(6).innerText()
        const parsed = money(amt)
        expect(expectMoney(parsed, spec.expectedGross), `${spec.expectedNumber} amount ${amt} ≈ ${spec.expectedGross}`)
          .toBeTruthy()
      }
    }
  })

  test('S4.14 — a saved draft shows Draft with no number and stays single', async ({ page, request }) => {
    const api = new Api(request)
    const resolve = await resolveMasters(api)
    const draftSpec = dataset.drafts[0]

    // Create as a draft (no /post) — mirrors Save draft.
    const body: Record<string, unknown> = {
      docType: draftSpec.docType,
      date: draftSpec.date,
      narration: draftSpec.narration,
      status: 'draft',
      party: draftSpec.party ? await resolve.party(draftSpec.party) : undefined,
      taxRate: draftSpec.taxRate ?? 0,
      lines: [],
    }
    for (const l of draftSpec.lines || []) {
      const line: Record<string, unknown> = { description: l.description || l.item, qty: l.qty, rate: l.rate }
      if (l.item) line.item = await resolve.item(l.item)
      ;(body.lines as unknown[]).push(line)
    }
    const created = await api.post<{ doc?: { id: number }; id?: number }>('/documents', body)
    const id = created?.doc?.id ?? created?.id
    expect(id).toBeTruthy()

    await page.goto('/vouchers')
    // The list has no narration column — locate the draft by its party cell
    // (Kathmandu Traders appears only on this row) and Draft status chip.
    const draftRow = page.locator('tr', { hasText: draftSpec.party! }).first()
    await expect(draftRow).toHaveCount(1)
    await expect(draftRow.getByText('Draft', { exact: true })).toBeVisible({ timeout: 10_000 })
    // Draft carries no number yet.
    expect(await draftRow.innerText()).not.toMatch(/SI-2083-84-\d/)
    // The draft must not appear twice (no optimistic duplicate).
    expect(await page.getByText(draftSpec.party!, { exact: true }).count()).toBe(1)
    // Leave the draft in the DB — the 07-offline suite (S4.14b) posts it later
    // and asserts exactly one numbered row.
  })
})

// Quick per-row duplicate check that runs after the month — every voucher
// number in the list must be unique.
test('S4.B — no voucher number is duplicated anywhere in the list', async ({ page }) => {
  await page.goto('/vouchers')
  // Wait for a real data row (the header row matches first and count() does
  // not auto-wait, so gate on the first month number being visible).
  const firstNumber = dataset.vouchers[0]!.expectedNumber!
  await expect(page.getByText(firstNumber, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  for (const spec of dataset.vouchers) {
    const n = spec.expectedNumber!
    const count = await page.getByText(n, { exact: true }).count()


    expect(count, `duplicate rows for ${n}`).toBe(1)
  }
})
