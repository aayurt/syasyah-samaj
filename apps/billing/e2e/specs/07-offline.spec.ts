import { expect, test } from '@playwright/test'
import { Api } from '../helpers/api'
import { dataset } from '../helpers/dataset'
import { resolveMasters } from '../helpers/voucherFlow'
import {
  expectVoucherRow,
  fillJournalLine,
  openVoucherForm,
  setNarration,
  setVoucherDate,
  submitVoucher,
  voucherRowCount,
} from '../helpers/ui'

/**
 * S7/S8 — Runs AFTER the reports suite so these mutations (posting the draft,
 * voiding a VAT invoice) cannot disturb the S6 register totals.
 *
 * - S4.14b: Save-draft → Save & post → exactly one posted row, numbered.
 * - S4.16: full void of a VAT invoice → doc flips Void, returns register
 *   reverses taxable + VAT (Sales + Sales Return reconcile).
 * - S8: offline draft → reconnect → single row, no duplicate.
 */
test.describe.serial('S7/S8 — post-report regressions + offline', () => {
  test('S4.14b — draft then post produces exactly one numbered row', async ({ page, request }) => {
    const api = new Api(request)
    const resolve = await resolveMasters(api)
    const draftSpec = dataset.drafts[0]

    // The draft was created by S4 (kept unposted there). Find and post it.
    const draft = await api.findOne('documents', 'narration', draftSpec.narration)
    expect(draft, 'S4 draft should exist').toBeTruthy()
    expect(draft!.status).toBe('draft')

    await api.post(`/documents/${draft!.id}/post`, {})
    await expectVoucherRow(page, 'SI-2083-84-0004')
    expect(await voucherRowCount(page, 'SI-2083-84-0004')).toBe(1)
    void resolve
  })

  test('S4.16 — full void of a VAT invoice reverses the returns register', async ({ page, request }) => {
    const api = new Api(request)
    const si = await api.findOne('documents', 'narration', 'Sales to Thamel Tours & Travels')
    expect(si, 'step-11 invoice should exist').toBeTruthy()

    await api.post(`/documents/${si!.id}/void`, { reason: 'E2E void test' })
    const after = await api.findOne('documents', 'narration', 'Sales to Thamel Tours & Travels')
    expect(after!.status).toBe('void')

    // Voiding generates a credit note CN-2083-84-0002.
    await expectVoucherRow(page, 'CN-2083-84-0002')

    // Registers reconcile: Thamel invoice was net 7,500 / VAT 975 — the
    // void credit note must reverse it exactly (see VAT_REGISTERS fix).
    const notes = await api.get<{ docs: any[] }>('/documents', {
      limit: 20,
      depth: 0,
      sort: '-id',
      'where[docType][equals]': 'credit-note',
    })
    const voidNote = notes.docs.find((d) => Number(d.id) > Number(si!.id)) || notes.docs[0]
    expect(voidNote, 'a void credit note exists').toBeTruthy()
    // Full void → the credit note mirrors the invoice: net 7,500, VAT 975.
    expect(Number(voidNote.netTotal) || 0).toBeCloseTo(7500, 0)
    expect(Number(voidNote.taxTotal) || 0).toBeCloseTo(975, 0)
  })

  test('S8.1/8.2 — offline save & post queues locally; reconnect flushes to one numbered row', async ({ page, request }) => {
    const api = new Api(request)
    const ctx = page.context()
    // Distinctive narration so we can find exactly this doc server-side after
    // the reconnect flush (the vouchers list has no narration column).
    const narration = `E2E offline journal ${Date.now()}`
    const jv = dataset.vouchers.find((v) => v.docType === 'journal-voucher')!
    const account = (name: string) => dataset.accounts.accounts.find((a) => a.name === name)!
    const cash = account('Cash in Hand')
    const capital = account('Capital')

    // 1. Online: load the journal form so the SPA chunks and the account list
    //    are in the local cache — a full reload while offline would fail.
    await openVoucherForm(page, 'journal-voucher')

    // 2. Baseline row count on the vouchers list (full reload, still online).
    await page.goto('/vouchers')
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 20_000 })
      .toBeGreaterThan(1)
    const rowsBefore = await page.locator('tbody tr').count()

    // 3. Go offline, then drive the form purely client-side: fill a balanced
    //    journal entry and Save & post. Writes queue to the sync engine's
    //    outbox (create + post custom op) and the router navigates locally.
    await page.goto(`/vouchers/new/journal-voucher`)
    await expect(page.getByRole('button', { name: 'Save & post' })).toBeVisible({ timeout: 15_000 })
    await ctx.setOffline(true)
    await setVoucherDate(page, jv.date)
    await fillJournalLine(page, 0, { accountLabel: `${cash.code} · ${cash.name}`, debit: 2222 })
    await fillJournalLine(page, 1, { accountLabel: `${capital.code} · ${capital.name}`, credit: 2222 })
    await setNarration(page, narration)
    await submitVoucher(page, true)

    // 4. Still offline — the optimistic row must appear in the list (+1), even
    //    though the server never saw it (no number yet, status Draft).
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(rowsBefore + 1)

    // 5. Reconnect — the engine detects online and flushes the outbox: the
    //    create maps local→server and the queued post assigns a number.
    await ctx.setOffline(false)
    await expect
      .poll(
        async () => {
          const d = await api.findOne('documents', 'narration', narration)
          return !!(d && d.status === 'posted')
        },
        { timeout: 60_000 },
      )
      .toBe(true)
    const posted = await api.findOne('documents', 'narration', narration)
    expect(posted, 'posted offline doc should exist').toBeTruthy()
    const number = String(posted!.number)
    expect(number).toMatch(/^JV-2083-84-\d{4}$/)

    // 6. Exactly one row for that number in the list — the flush must not
    //    duplicate the doc, and the total row count is unchanged (+1).
    await expectVoucherRow(page, number)
    expect(await voucherRowCount(page, number)).toBe(1)
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 20_000 })
      .toBe(rowsBefore + 1)
  })

  test('S8.3 — offline writes survive app restarts and flush on cold start', async ({ page, request }) => {
    const api = new Api(request)
    const narration = `E2E cold-start journal ${Date.now()}`
    const jv = dataset.vouchers.find((v) => v.docType === 'journal-voucher')!
    const account = (name: string) => dataset.accounts.accounts.find((a) => a.name === name)!
    const cash = account('Cash in Hand')
    const capital = account('Capital')

    // 1. Online: load the journal form so the account list populates the
    //    local cache (a cold boot with the API down reads it from cache).
    await openVoucherForm(page, 'journal-voucher')
    await expect
      .poll(() => page.locator('table tbody tr').first().locator('select option').count(), { timeout: 15_000 })
      .toBeGreaterThan(5)

    // 2. Baseline voucher list row count.
    await page.goto('/vouchers')
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 20_000 })
      .toBeGreaterThan(1)
    const rowsBefore = await page.locator('tbody tr').count()

    // 3. Simulate the desktop cold-start-offline state: assets reachable but
    //    every /api request aborted. Cold-boot the app, then queue a write
    //    through the UI — it goes to the persistent outbox, not the network.
    await page.route('**/api/**', (route) => route.abort())
    await page.goto('/vouchers/new/journal-voucher')
    await expect(page.getByRole('button', { name: 'Save & post' })).toBeVisible({ timeout: 20_000 })
    await setVoucherDate(page, jv.date)
    await fillJournalLine(page, 0, { accountLabel: `${cash.code} · ${cash.name}`, debit: 3333 })
    await fillJournalLine(page, 1, { accountLabel: `${capital.code} · ${capital.name}`, credit: 3333 })
    await setNarration(page, narration)
    await submitVoucher(page, true)
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 15_000 })
      .toBe(rowsBefore + 1)

    // 4. Restart the app while still offline — the queued op must survive the
    //    cold boot in persistent storage and still render in the list.
    await page.reload()
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 20_000 })
      .toBe(rowsBefore + 1)

    // 5. Connectivity returns; cold-start once more. init() re-queues the
    //    pending op and flushes it automatically — no manual resync — and the
    //    doc lands as a single numbered row (no duplicate).
    await page.unroute('**/api/**')
    await page.reload()
    await expect
      .poll(
        async () => {
          const d = await api.findOne('documents', 'narration', narration)
          return !!(d && d.status === 'posted')
        },
        { timeout: 60_000 },
      )
      .toBe(true)
    const posted = await api.findOne('documents', 'narration', narration)
    expect(posted, 'cold-start flush should post the offline doc').toBeTruthy()
    const number = String(posted!.number)
    expect(number).toMatch(/^JV-2083-84-\d{4}$/)
    await expectVoucherRow(page, number)
    expect(await voucherRowCount(page, number)).toBe(1)
    await expect
      .poll(() => page.locator('tbody tr').count(), { timeout: 20_000 })
      .toBe(rowsBefore + 1)
  })
})
