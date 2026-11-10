/**
 * Proration engine — mid-month joins / leavers / unpaid leave.
 *
 * Pure functions, no Payload/DB. Determines how many working days an
 * employee actually worked in a period, given join date, leaving date, and
 * unpaid leave days.
 *
 * Ported from QniPay `backend/src/utils/prorationEngine.ts`.
 */

import { listDates } from './payrollDays'

/**
 * Input to completed-months proration.
 */
export interface CompletedMonthsInput {
  joiningDate?: string | null
  leavingDate?: string | null
  periodStart: string
  periodEnd: string
  rule: 'FULL_CALENDAR_MONTH' | 'PARTIAL_MONTH'
}

/**
 * Compute completed months for proration under the FULL_CALENDAR_MONTH rule:
 * an employee must be employed for the full calendar month to earn a full
 * month's salary; partial months are prorated by working days.
 *
 * Returns { completedMonths, isFullMonth }.
 */
export function computeCompletedMonths(input: CompletedMonthsInput): {
  completedMonths: number
  isFullMonth: boolean
} {
  const { joiningDate, leavingDate, periodStart, periodEnd, rule } = input

  // Employee not yet joined or already left → 0 completed months.
  if (joiningDate && joiningDate > periodEnd) return { completedMonths: 0, isFullMonth: false }
  if (leavingDate && leavingDate < periodStart) return { completedMonths: 0, isFullMonth: false }

  const ps = new Date(periodStart + 'T00:00:00Z')
  const pe = new Date(periodEnd + 'T00:00:00Z')

  // Full calendar month = employee employed for the entire period.
  const employedFullPeriod =
    (!joiningDate || joiningDate <= periodStart) &&
    (!leavingDate || leavingDate >= periodEnd)

  if (rule === 'FULL_CALENDAR_MONTH') {
    if (employedFullPeriod) return { completedMonths: 1, isFullMonth: true }
    // Partial month → 0 completed months, proration handled by working days.
    return { completedMonths: 0, isFullMonth: false }
  }

  // PARTIAL_MONTH: count calendar months spanned by employment within period.
  let months = 0
  let cursor = new Date(ps.getTime())
  while (cursor <= pe) {
    const mStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
    const mEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    // Is this month at least partly within the employment window?
    const empStart = joiningDate ? new Date(joiningDate + 'T00:00:00Z') : mStart
    const empEnd = leavingDate ? new Date(leavingDate + 'T00:00:00Z') : mEnd
    if (empStart <= mEnd && empEnd >= mStart) months++
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return { completedMonths: months, isFullMonth: employedFullPeriod }
}

/**
 * Prorate an amount by a day ratio. Rounded to 2 dp.
 */
export function prorateByDays(
  fullAmount: number,
  payableDays: number,
  totalDays: number,
): number {
  if (!totalDays || totalDays <= 0) return 0
  return Math.round((fullAmount * payableDays) / totalDays * 100) / 100
}

/**
 * Count working dates between two AD dates inclusive, restricted to a given
 * set of working dates (e.g. excluding weekends/holidays).
 */
export function countWorkingDatesInRange(
  workingDates: string[],
  rangeStart: string,
  rangeEnd: string,
): number {
  const ws = new Set(workingDates)
  const dates = listDates(rangeStart, rangeEnd)
  return dates.filter((d) => ws.has(d)).length
}

/**
 * Compute payable working days for an employee in a period:
 *
 *   payableWorkingDays = workingDays − unpaidLeave − absence − joinerGap − leaverGap
 *
 *   joinerGap   = working days from period start to day before joining
 *   leaverGap   = working days from day after leaving to period end
 */
export function computePayableWorkingDays({
  workingDays,
  totalDays,
  unpaidLeaveDays,
  absenceDays,
  joinerDays,
  leaverDays,
}: {
  workingDays: number
  totalDays: number
  unpaidLeaveDays: number
  absenceDays: number
  joinerDays: number
  leaverDays: number
}): number {
  return Math.max(0, workingDays - unpaidLeaveDays - absenceDays - joinerDays - leaverDays)
}

/**
 * Compute payable calendar days for an employee in a period:
 *
 *   payableDays = totalDays − weekendDays − publicHolidayDays − unpaidLeave − absence − joinerGap − leaverGap
 */
export function computePayableDays({
  totalDays,
  weekendDays,
  publicHolidayDays,
  unpaidLeaveDays,
  absenceDays,
  joinerDays,
  leaverDays,
}: {
  totalDays: number
  weekendDays: number
  publicHolidayDays: number
  unpaidLeaveDays: number
  absenceDays: number
  joinerDays: number
  leaverDays: number
}): number {
  return Math.max(
    0,
    totalDays - weekendDays - publicHolidayDays - unpaidLeaveDays - absenceDays - joinerDays - leaverDays,
  )
}
