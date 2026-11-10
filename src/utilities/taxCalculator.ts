/**
 * Nepal statutory tax calculator — SSF, PF, CIT.
 *
 * Pure functions, no Payload/DB. Replaces India `indiaPayroll.ts` when the
 * Nepal country toggle is on in Payroll Settings.
 *
 * Rates (Nepal, FY 2083-84 / 2026-27):
 *   SSF: 11% employee + 11% employer on basic salary (min basic NPR 7,000)
 *   PF:  10% employee + 10% employer on basic salary
 *   CIT slabs (individual, monthly → annualised):
 *     First NPR 500,000: 1%
 *     Next NPR 200,000:  15%
 *     Next NPR 1,500,000: 25%
 *     Above:             25% + surcharge
 *   Standard deduction: NPR 500,000 (salary income)
 *   Rebate: NPR 300,000 × rate for women/disabled/etc.
 *
 * Ported from QniPay `backend/src/utils/taxCalculator.ts` (Nepal variant).
 */

import { round2 } from './journalValidation'

/** Input to statutory calculation. */
export interface StatutoryInput {
  basicSalary: number
  grossSalary: number
  maritalStatus?: 'SINGLE' | 'MARRIED'
  isDisabled?: boolean
  isWomen?: boolean
  isRemoteArea?: boolean
  insuranceAmount?: number
  donationAmount?: number
  payPeriodsInYear?: number
}

/** Output of statutory calculation. */
export interface StatutoryOutput {
  ssfEmployee: number
  ssfEmployer: number
  pfEmployee: number
  pfEmployer: number
  citMonthly: number
  citAnnual: number
  annualTaxableIncome: number
  totalDeductions: number
  netSalary: number
  componentBreakdown: Array<{
    componentCode: string
    componentName: string
    componentType: 'earning' | 'deduction'
    amount: number
    taxable: number
  }>
}

/** CIT slab: { from, to, rate } where `to` is exclusive (or Infinity). */
const CIT_SLABS = [
  { from: 0, to: 500_000, rate: 0.01 },
  { from: 500_000, to: 700_000, rate: 0.15 },
  { from: 700_000, to: 2_200_000, rate: 0.25 },
  { from: 2_200_000, to: Infinity, rate: 0.25 },
] as const

const SSF_RATE = 0.11
const PF_RATE = 0.10
const SSF_MIN_BASIC = 7000
const STANDARD_DEDUCTION = 500_000

/**
 * Compute Nepal SSF + PF + CIT deductions from basic salary.
 *
 * SSF takes precedence over PF when both enabled — only SSF is deducted.
 * CIT is computed on annual taxable income (gross × 12 − standard deduction)
 * and divided by pay periods for the monthly instalment.
 */
export function calculateNepalStatutory(
  input: StatutoryInput,
  opts: { ssfEnabled?: boolean; pfEnabled?: boolean; citEnabled?: boolean; ssfRate?: number; pfRate?: number; ssfMinBasic?: number } = {},
): StatutoryOutput {
  const {
    ssfEnabled = true,
    pfEnabled = true,
    citEnabled = true,
    ssfRate = SSF_RATE,
    pfRate = PF_RATE,
    ssfMinBasic = SSF_MIN_BASIC,
  } = opts

  const basic = round2(input.basicSalary)
  const gross = round2(input.grossSalary)
  const periods = input.payPeriodsInYear ?? 12

  let ssfEmployee = 0
  let ssfEmployer = 0
  let pfEmployee = 0
  let pfEmployer = 0

  // SSF: 11% each side on basic, applies when basic ≥ min basic.
  if (ssfEnabled && basic >= ssfMinBasic) {
    ssfEmployee = round2(basic * ssfRate)
    ssfEmployer = round2(basic * ssfRate)
  }
  // PF: 10% each side on basic, only when SSF is NOT enabled.
  else if (pfEnabled && basic >= ssfMinBasic) {
    pfEmployee = round2(basic * pfRate)
    pfEmployer = round2(basic * pfRate)
  }

  // CIT: annual taxable = gross × periods − standard deduction.
  // Apply slabs, then monthly instalment = annual tax / periods.
  let citAnnual = 0
  let annualTaxableIncome = 0
  if (citEnabled) {
    annualTaxableIncome = Math.max(0, gross * periods - STANDARD_DEDUCTION)
    let remaining = annualTaxableIncome
    let tax = 0
    for (const slab of CIT_SLABS) {
      const slabAmount = Math.max(0, Math.min(remaining, slab.to - slab.from))
      tax += slabAmount * slab.rate
      remaining -= slabAmount
      if (remaining <= 0) break
    }
    citAnnual = round2(tax)
  }
  const citMonthly = round2(citAnnual / periods)

  const totalDeductions = round2(ssfEmployee + pfEmployee + citMonthly)
  const netSalary = round2(gross - totalDeductions)

  return {
    ssfEmployee,
    ssfEmployer,
    pfEmployee,
    pfEmployer,
    citMonthly,
    citAnnual,
    annualTaxableIncome,
    totalDeductions,
    netSalary,
    componentBreakdown: [
      { componentCode: 'BASIC', componentName: 'Basic Salary', componentType: 'earning', amount: basic, taxable: 1 },
      ...(ssfEmployee > 0 ? [{ componentCode: 'SSF_EE', componentName: 'SSF (Employee)', componentType: 'deduction' as const, amount: ssfEmployee, taxable: 0 }] : []),
      ...(pfEmployee > 0 ? [{ componentCode: 'PF_EE', componentName: 'PF (Employee)', componentType: 'deduction' as const, amount: pfEmployee, taxable: 0 }] : []),
      ...(citMonthly > 0 ? [{ componentCode: 'CIT', componentName: 'Income Tax', componentType: 'deduction' as const, amount: citMonthly, taxable: 0 }] : []),
    ],
  }
}

/** Backward-compatible wrapper: returns shape expected by QniPay processor. */
export function calculatePayrollWithAttendance(
  input: StatutoryInput,
  totalDaysInPeriod: number,
  ruleContext: any = {},
): StatutoryOutput {
  return calculateNepalStatutory(input, {
    ssfEnabled: ruleContext.ssfEnabled !== false,
    pfEnabled: ruleContext.pfEnabled !== false,
    citEnabled: ruleContext.citEnabled !== false,
  })
}

/** Legacy export name used by some callers. */
export const calculatePayroll = calculatePayrollWithAttendance
export const calculateSSF = (basic: number, enabled: boolean) =>
  enabled && basic >= SSF_MIN_BASIC ? round2(basic * SSF_RATE) : 0
export const calculatePF = (basic: number, enabled: boolean) =>
  enabled && basic >= SSF_MIN_BASIC ? round2(basic * PF_RATE) : 0
export const calculateAnnualTax = (
  monthlyGross: number,
  periods: number,
  enabled: boolean,
): number => {
  if (!enabled) return 0
  const annualTaxable = Math.max(0, monthlyGross * periods - STANDARD_DEDUCTION)
  let remaining = annualTaxable
  let tax = 0
  for (const slab of CIT_SLABS) {
    const slabAmount = Math.max(0, Math.min(remaining, slab.to - slab.from))
    tax += slabAmount * slab.rate
    remaining -= slabAmount
    if (remaining <= 0) break
  }
  return round2(tax)
}
