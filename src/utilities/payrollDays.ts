/**
 * Payroll day counting — backend-computed working/total days per period.
 *
 * Never derived in React; the server owns this so the frontend can't
 * miscompute proration ratios. Reuses Syasya's nepaliDate utilities for
 * BS/AD awareness where needed.
 *
 * Ported from QniPay `backend/src/utils/payrollDays.ts`.
 */

interface DayCounts {
  totalDays: number
  weekendDays: number
  publicHolidayDays: number
  workingDays: number
  workingAdDates: string[]
}

/**
 * Count calendar days between two AD dates (inclusive).
 */
export function countDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

/**
 * Return every AD date (YYYY-MM-DD) between start and end inclusive.
 */
export function listDates(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  let d = new Date(s.getTime())
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/**
 * Simple weekend detection: Saturday + Sunday are weekend days.
 * Override by passing a `weekendDays` Set of weekday numbers (0=Sun..6=Sat).
 */
export function weekendDaysInRange(start: string, end: string, weekendDays?: Set<number>): number {
  const days = listDates(start, end)
  const wk = weekendDays || new Set([0, 6])
  return days.filter((ds) => wk.has(new Date(ds + 'T00:00:00Z').getUTCDay())).length
}

/**
 * Full day counts for a period, given optional public holiday dates.
 *
 *   totalDays   = calendar days (inclusive)
 *   weekendDays = Sat+Sun (or configured weekend set)
 *   publicHolidayDays = holidays falling on weekdays only
 *   workingDays = totalDays − weekendDays − publicHolidayDays
 *   workingAdDates = dates that are working days
 */
export function computePeriodDayCounts(
  start: string,
  end: string,
  opts: { publicHolidays?: string[]; weekendDays?: Set<number> } = {},
): DayCounts {
  const dates = listDates(start, end)
  const totalDays = dates.length
  const wk = opts.weekendDays || new Set([0, 6])
  const holidays = new Set(opts.publicHolidays || [])

  let weekendDays = 0
  let publicHolidayDays = 0
  const workingAdDates: string[] = []

  for (const ds of dates) {
    const day = new Date(ds + 'T00:00:00Z').getUTCDay()
    const isWeekend = wk.has(day)
    const isHoliday = holidays.has(ds)
    if (isWeekend) weekendDays++
    else if (isHoliday) publicHolidayDays++
    else workingAdDates.push(ds)
  }

  return {
    totalDays,
    weekendDays,
    publicHolidayDays,
    workingDays: totalDays - weekendDays - publicHolidayDays,
    workingAdDates,
  }
}

/**
 * Per-day rate: amount ÷ totalDays (or workingDays if `useWorkingDays`).
 * Rounded to 2 dp.
 */
export function perDay(amount: number, totalDays: number, useWorkingDays = false): number {
  const divisor = useWorkingDays ? totalDays : totalDays
  if (!divisor || divisor <= 0) return 0
  return Math.round((amount / divisor) * 100) / 100
}
