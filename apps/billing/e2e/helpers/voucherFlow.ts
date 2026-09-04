import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Api } from './api'
import type { Dataset, VoucherSpec } from './dataset'
import { dataset } from './dataset'
import { expectMoney } from './money'
import {
  addItemLines,
  addJournalLines,
  fillItemLine,
  fillJournalLine,
  openVoucherForm,
  setNarration,
  setVoucherDate,
  submitVoucher,
  voucherRowCount,
} from './ui'

/** Resolve ids for accounts/parties/items by name via the API (as the seed does). */
export async function resolveMasters(api: Api) {
  const byName = async (slug: string, name: string) => {
    const doc = await api.findOne(slug, 'name', name)
    if (!doc) throw new Error(`Missing seeded ${slug} "${name}" — run SKIP_VOUCHERS=1 node billing-seed.mjs`)
    return Number(doc.id)
  }
  return {
    party: (n: string) => byName('parties', n),
    item: (n: string) => byName('items', n),
    account: (n: string) => byName('gl-accounts', n),
  }
}

/**
 * Create one voucher through the API using the same endpoints the SPA posts
 * to (POST /documents then POST /documents/:id/post). Mirrors billing-seed.
 * Returns the assigned number.
 */
export async function createVoucherViaApi(
  api: Api,
  spec: VoucherSpec,
  resolve: Awaited<ReturnType<typeof resolveMasters>>,
  referenceToId?: number,
): Promise<{ number: string; doc: any }> {
  const body: Record<string, unknown> = {
    docType: spec.docType,
    date: spec.date,
    narration: spec.narration,
    status: 'draft',
  }
  if (spec.party) body.party = await resolve.party(spec.party)
  if (spec.paymentMethod) body.paymentMethod = spec.paymentMethod
  if (referenceToId) body.referenceTo = referenceToId
  if (spec.taxRate !== undefined) body.taxRate = spec.taxRate

  if (spec.journalLines) {
    body.journalLines = []
    for (const jl of spec.journalLines) {
      ;(body.journalLines as unknown[]).push({
        account: await resolve.account(jl.account),
        debit: jl.debit,
        credit: jl.credit,
      })
    }
  } else if (spec.lines) {
    body.lines = []
    for (const l of spec.lines) {
      const line: Record<string, unknown> = {
        description: l.description || l.item,
        qty: l.qty,
        rate: l.rate,
      }
      if (l.item) line.item = await resolve.item(l.item)
      ;(body.lines as unknown[]).push(line)
    }
  }

  const created = await api.post<{ doc?: { id: number }; id?: number }>('/documents', body)
  const id = created?.doc?.id ?? created?.id
  if (!id) throw new Error(`Create ${spec.docType} returned no id`)
  const res = await api.post<{ number?: string; doc?: any }>(`/documents/${id}/post`, {})
  return { number: res.number || '', doc: res.doc }
}

/**
 * Drive one voucher through the real form UI (date, lines, notes, Save & post).
 * Representative vouchers only — journal entry (step 1) and petty cash (step 10).
 */
export async function createVoucherViaUi(page: Page, spec: VoucherSpec) {
  await openVoucherForm(page, spec.docType)
  await setVoucherDate(page, spec.date)

  if (spec.docType === 'journal-voucher') {
    // Form starts with 2 empty journal lines; opening capital needs 4.
    const extra = spec.journalLines!.length - 2
    if (extra > 0) await addJournalLines(page, extra)
    for (let i = 0; i < spec.journalLines!.length; i++) {
      const jl = spec.journalLines![i]
      const acct = dataset.accounts.accounts.find((a) => a.name === jl.account)!
      const label = acct.code ? `${acct.code} · ${acct.name}` : acct.name
      await fillJournalLine(page, i, {
        accountLabel: label,
        debit: jl.debit,
        credit: jl.credit,
      })
    }
  } else if (spec.docType === 'petty-cash-voucher' && spec.lines) {
    const extra = spec.lines.length - 1
    if (extra > 0) await addItemLines(page, extra)
    for (let i = 0; i < spec.lines.length; i++) {
      const l = spec.lines[i]
      await fillItemLine(page, i, {
        description: l.description,
        qty: l.qty,
        rate: l.rate,
      })
    }
  }

  await setNarration(page, spec.narration)
  await submitVoucher(page, true)
}

/**
 * Assert a posted voucher appears exactly once with the expected number.
 * Returns the row count (must be 1 — the duplicate regression check).
 */
export async function assertSinglePosted(page: Page, spec: VoucherSpec) {
  const count = await voucherRowCount(page, spec.expectedNumber!)
  expect(count, `${spec.expectedNumber} must appear exactly once`).toBe(1)
}

export { expectMoney }
