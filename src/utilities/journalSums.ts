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
): Promise<Map<number, { debit: number; credit: number }>> {
  const where: any = { status: { equals: 'posted' }, ...(extraWhere || {}) }
  const res = await payload.find({
    collection: 'journal-entries',
    where,
    limit: 1000,
    depth: 0,
  })
  const sums = new Map<number, { debit: number; credit: number }>()
  for (const entry of res.docs as any[]) {
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
  return sums
}
