import type { Payload } from 'payload'
import { toNum } from './journalValidation'

/**
 * Sums the debit/credit totals of posted journal entries by account.
 * `extraWhere` merges additional filters (e.g. date ranges) on top of the
 * mandatory `status = posted`. Returns a Map of accountId → { debit, credit }.
 */
export async function sumPostedByAccount(
  payload: Payload,
  extraWhere?: Record<string, unknown>,
  overrideAccess = false,
): Promise<Map<number, { debit: number; credit: number }>> {
  const where: any = { status: { equals: 'posted' }, ...(extraWhere || {}) }
  const sums = new Map<number, { debit: number; credit: number }>()
  let page = 1
  const PAGE = 1000
  let got: any[]
  // Paginate until the entry set is exhausted — never report totals from a
  // truncated fetch.
  do {
    const res = await payload.find({
      collection: 'journal-entries',
      where,
      limit: PAGE,
      page,
      depth: 0,
      overrideAccess,
    })
    got = res.docs as any[]
    for (const entry of got) {
      for (const line of entry.lines || []) {
        const accId =
          typeof line.account === 'object' && line.account
            ? line.account.id
            : line.account
        if (accId === undefined || accId === null) continue
        const id = Number(accId)
        const s = sums.get(id) || { debit: 0, credit: 0 }
        s.debit += toNum(line.debit)
        s.credit += toNum(line.credit)
        sums.set(id, s)
      }
    }
    page += 1
  } while (got.length === PAGE)
  return sums
}
