/**
 * Payroll calculation engine — element → method → value resolution.
 *
 * Pure functions, no Payload/DB. Each earning/deduction element carries a
 * calculation method code; the engine resolves the method and applies it to
 * the element's base amount, considering proration for joiners/leavers and
 * unpaid leave.
 *
 * Ported from QniPay `backend/src/utils/calcEngine.ts`.
 */

import { computePeriodDayCounts, perDay } from './payrollDays'

/** One payroll element (earning or deduction). */
export interface PayrollElement {
  id: number
  code: string
  name: string
  type: 'earning' | 'deduction'
  amount: number            // full (unprorated) amount
  methodCode?: string       // e.g. 'FIXED_AMOUNT', 'PRORATE_WORKING_DAYS', 'PRORATE_TOTAL_DAYS', 'PRORATE_COMPLETED_MONTHS'
  methodVersion?: number
  taxable?: number
  pensionable?: number
}

/** Context passed to every method resolution. */
export interface CalcContext {
  workingDays: number
  totalDays: number
  weekendDays: number
  publicHolidayDays: number
  payableWorkingDays: number
  payableDays: number
  unpaidLeaveDays: number
  absenceDays: number
  joinerDays: number
  leaverDays: number
  prorateJoiner: boolean
  prorateLeaver: boolean
  prorateUnpaidLeave: boolean
  completedMonths?: number
  annualMonths?: number
}

/** Result of calculating one element. */
export interface CalcResult {
  elementCode: string
  elementName: string
  fullValue: number
  proratedValue: number
  formula: string
  methodCode: string
  methodName: string
}

/**
 * Resolve the effective calculation method for an element:
 *   - ADJUSTMENT → FIXED_AMOUNT (no proration)
 *   - element override methodCode → use it
 *   - else → setup default method
 */
export function resolveMethod(
  element: PayrollElement,
  setupMethod: { code: string; name: string } | null,
): { code: string; name: string } {
  if (element.type === 'deduction' && element.code?.toUpperCase() === 'ADJUSTMENT') {
    return { code: 'FIXED_AMOUNT', name: 'Fixed Amount' }
  }
  if (element.methodCode) {
    return { code: element.methodCode, name: element.methodCode.replace(/_/g, ' ').toLowerCase() }
  }
  return setupMethod ?? { code: 'FIXED_AMOUNT', name: 'Fixed Amount' }
}

/**
 * Apply a calculation method to an element amount, returning the prorated
 * value and a human-readable formula.
 */
export function applyMethod(
  amount: number,
  method: { code: string; name: string },
  ctx: CalcContext,
): { value: number; formula: string } {
  const code = method.code
  const full = Math.round(amount * 100) / 100

  switch (code) {
    case 'FIXED_AMOUNT':
      return { value: full, formula: `${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (fixed amount)` }

    case 'PRORATE_WORKING_DAYS':
      return {
        value: perDay(full, ctx.workingDays, true) * ctx.payableWorkingDays,
        formula: `${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${ctx.payableWorkingDays} / ${ctx.workingDays}`,
      }

    case 'PRORATE_TOTAL_DAYS':
      return {
        value: perDay(full, ctx.totalDays) * ctx.payableDays,
        formula: `${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${ctx.payableDays} / ${ctx.totalDays}`,
      }

    case 'PRORATE_COMPLETED_MONTHS': {
      const months = ctx.completedMonths ?? 0
      const annual = ctx.annualMonths ?? 12
      return {
        value: Math.round((full * months) / annual * 100) / 100,
        formula: `${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${months} / ${annual}`,
      }
    }

    case 'OT_HOURS_RATE_MULTIPLIER':
    case 'OT_HOURS_RATE': {
      const rate = full
      const hours = ctx.payableDays // placeholder: real OT hours come from timesheet input
      return {
        value: Math.round(rate * hours * 100) / 100,
        formula: `${hours} hrs × ${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }
    }

    default:
      return { value: full, formula: `${full.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (fixed amount)` }
  }
}

/**
 * Calculate one element: resolve method → apply → return result.
 */
export function calculateElement(
  element: PayrollElement,
  setupMethod: { code: string; name: string } | null,
  ctx: CalcContext,
): CalcResult {
  const method = resolveMethod(element, setupMethod)
  const { value, formula } = applyMethod(element.amount, method, ctx)
  return {
    elementCode: element.code,
    elementName: element.name,
    fullValue: Math.round(element.amount * 100) / 100,
    proratedValue: Math.round(value * 100) / 100,
    formula,
    methodCode: method.code,
    methodName: method.name,
  }
}
