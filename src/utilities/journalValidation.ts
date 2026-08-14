export type JournalLineLike = {
  account?: number | string | { id: number | string } | null
  debit?: number | string | null
  credit?: number | string | null
  memo?: string | null
}

export const JOURNAL_EPSILON = 0.001

export function toNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/**
 * Validates a set of double-entry lines (one side per line, non-negative,
 * debits == credits). Returns a list of human-readable errors (empty = valid).
 */
export function validateJournalLines(
  lines: JournalLineLike[] | null | undefined,
): string[] {
  const errors: string[] = []
  if (!lines || lines.length === 0) {
    errors.push('At least one journal line is required.')
    return errors
  }

  let totalDebit = 0
  let totalCredit = 0

  for (const line of lines) {
    if (!line.account) {
      errors.push('Every journal line needs an account.')
      continue
    }
    const debit = toNum(line.debit)
    const credit = toNum(line.credit)
    if (debit < 0 || credit < 0) {
      errors.push('Debit and credit amounts cannot be negative.')
    }
    if (debit > 0 && credit > 0) {
      errors.push('A journal line cannot have both debit and credit.')
    }
    if (debit === 0 && credit === 0) {
      errors.push('Every journal line needs a debit or a credit amount.')
    }
    totalDebit += debit
    totalCredit += credit
  }

  if (Math.abs(totalDebit - totalCredit) > JOURNAL_EPSILON) {
    errors.push(
      `Journal entry is not balanced: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}.`,
    )
  }

  return errors
}
