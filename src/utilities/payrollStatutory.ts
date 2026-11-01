import { round2 } from './journalValidation'
import {
  LWF_STATE_CONFIG,
  STATE_PT_CONFIG,
  computeEPF,
  computeESI,
  computeIncomeTax,
  computeLWF,
  computeProfessionalTax,
  computeStatutoryWages,
  epfoRound,
} from './indiaPayroll'
import type { PayrollRunLine } from './payrollCalc'

/**
 * Statutory wiring for payroll runs — the glue between the india-payroll
 * engine (indiaPayroll.ts) and the run generator/poster.
 *
 * applyStatutoryDeductions takes computed run lines plus the per-employee
 * statutory context and:
 *   - appends employee deduction rows (EPF, VPF, ESI, PT, LWF, TDS) with
 *     their payable accounts, then recomputes each line's net;
 *   - returns run-level employer contributions (EPF split EPS/EPF/EDLI/admin,
 *     ESI employer, LWF employer) for the posting journal;
 *   - stores a per-line `statutory` snapshot (PF/ESI wages + every computed
 *     amount) that the statutory register reports render from.
 *
 * Everything is gated: a statute with its toggle off (or an employee
 * opt-out) contributes nothing, so enabling compliance never changes runs
 * generated before the switch was flipped.
 */

export interface StatutorySettings {
  epfEnabled?: boolean
  esicEnabled?: boolean
  professionalTaxEnabled?: boolean
  lwfEnabled?: boolean
  tdsEnabled?: boolean
  defaultEmploymentState?: string | null
  epfPayableAccount?: number | null
  epsPayableAccount?: number | null
  edliPayableAccount?: number | null
  esicPayableAccount?: number | null
  ptPayableAccount?: number | null
  lwfPayableAccount?: number | null
  tdsPayableAccount?: number | null
  statutoryExpenseAccount?: number | null
}

/** Statutory context carried by an Employee document. */
export interface StatutoryEmployee {
  id?: number | string
  employmentState?: string | null
  gender?: string | null
  taxRegime?: string | null
  epfApplicable?: boolean | null
  lwfExempt?: boolean | null
  vpfAmount?: number | string | null
}

export interface StatutoryContribution {
  label: string
  amount: number
  account: number | null
}

/** Per-line snapshot persisted on the run for the register reports. */
export interface StatutoryLineSnapshot {
  pfWage?: number
  esiWage?: number
  epf?: { cappedWage: number; employee: number; eps: number; employerEpf: number; edli: number; admin: number }
  esi?: { covered: boolean; ceiling: number; employee: number; employer: number }
  pt?: number
  lwf?: { employee: number; employer: number }
  tds?: number
}

export interface PriorPTRow {
  gross: number
  ptDeducted: number
}

function acct(v: number | null | undefined): number | null {
  return v != null && Number(v) > 0 ? Number(v) : null
}

/**
 * Prior pay periods inside the same PT accumulation window as `period`
 * (YYYY-MM). Half-yearly states run April–September and October–March;
 * yearly states run the April–March fiscal year. Mirrors frappe's
 * _half_year_period / _fiscal_year_period.
 */
export function ptPriorPeriods(
  frequency: 'half-yearly' | 'yearly',
  period: string,
): string[] {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const out: string[] = []
  const push = (y: number, m: number) =>
    out.push(`${y}-${String(m).padStart(2, '0')}`)

  if (frequency === 'half-yearly') {
    if (month >= 4 && month <= 9) {
      for (let m = 4; m < month; m++) push(year, m)
    } else {
      // October–March window spans the year boundary.
      const startYear = month >= 10 ? year : year - 1
      for (const [y, m] of [
        [startYear, 10],
        [startYear, 11],
        [startYear, 12],
        [startYear + 1, 1],
        [startYear + 1, 2],
        [startYear + 1, 3],
      ] as const) {
        const key = `${y}-${String(m).padStart(2, '0')}`
        if (key < period) out.push(key)
      }
    }
    return out
  }

  // Yearly: April–March fiscal year, everything before `period`.
  const startYear = month >= 4 ? year : year - 1
  for (let m = 4; m <= 12; m++) push(startYear, m)
  for (let m = 1; m <= 3; m++) push(startYear + 1, m)
  return out.filter((p) => p < period)
}

/**
 * Apply statutory deductions to run lines and collect employer
 * contributions. Lines are copied, never mutated.
 *
 * `employees` is keyed by the line's employee id; `priorPT` carries each
 * employee's cumulative gross/PT inside the current half-year or fiscal
 * window (needed by periodic-frequency PT states).
 */
export function applyStatutoryDeductions(
  lines: PayrollRunLine[],
  employees: Map<number | string, StatutoryEmployee>,
  settings: StatutorySettings,
  period: string,
  priorPT?: Map<number | string, PriorPTRow>,
): { lines: PayrollRunLine[]; employerContributions: StatutoryContribution[] } {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const periodStart = `${period}-01`
  const periodEnd = `${period}-${String(
    new Date(Date.UTC(year, month, 0)).getUTCDate(),
  ).padStart(2, '0')}`

  const out: PayrollRunLine[] = []
  const contributions = new Map<string, StatutoryContribution>()
  const addContribution = (label: string, amount: number, account: number | null) => {
    if (amount <= 0) return
    const existing = contributions.get(label)
    if (existing) {
      existing.amount = round2(existing.amount + amount)
    } else {
      contributions.set(label, { label, amount: round2(amount), account })
    }
  }

  for (const line of lines) {
    const emp =
      line.employee != null ? employees.get(line.employee) : undefined
    const state = emp?.employmentState || settings.defaultEmploymentState || ''
    const gender = emp?.gender || undefined
    const snapshot: StatutoryLineSnapshot = {}
    const extra: PayrollRunLine['deductions'] = []

    const { pfWage, esiWage } = computeStatutoryWages(line.basic, line.allowances)

    /* EPF + VPF */
    if (settings.epfEnabled && emp?.epfApplicable !== false && pfWage > 0) {
      const epf = computeEPF({ pfWage, periodStart, periodEnd })
      snapshot.pfWage = pfWage
      snapshot.epf = epf
      if (epf.employee > 0) {
        extra.push({
          label: 'Provident Fund',
          amount: epf.employee,
          account: acct(settings.epfPayableAccount),
        })
      }
      const vpf = epfoRound(Number(emp?.vpfAmount) || 0)
      if (vpf > 0) {
        extra.push({
          label: 'Voluntary Provident Fund',
          amount: vpf,
          account: acct(settings.epfPayableAccount),
        })
      }
      const epfPayable = acct(settings.epfPayableAccount)
      const edliPayable = acct(settings.edliPayableAccount) ?? epfPayable
      addContribution('EPS', epf.eps, acct(settings.epsPayableAccount) ?? epfPayable)
      addContribution('EPF (Employer)', epf.employerEpf, epfPayable)
      addContribution('EDLI', epf.edli, edliPayable)
      addContribution('EPF Admin', epf.admin, edliPayable)
    }

    /* ESI */
    if (settings.esicEnabled && esiWage > 0) {
      const esi = computeESI({ wage: esiWage })
      snapshot.esiWage = esiWage
      snapshot.esi = esi
      if (esi.covered) {
        if (esi.employee > 0) {
          extra.push({
            label: 'Employee State Insurance',
            amount: esi.employee,
            account: acct(settings.esicPayableAccount),
          })
        }
        addContribution('ESI (Employer)', esi.employer, acct(settings.esicPayableAccount))
      }
    }

    /* Professional Tax */
    if (settings.professionalTaxEnabled && state && STATE_PT_CONFIG[state]) {
      const frequency = STATE_PT_CONFIG[state].frequency
      const pt =
        frequency === 'monthly'
          ? computeProfessionalTax({
              state,
              gross: line.gross,
              month,
              gender,
              asOf: periodStart,
            })
          : computeProfessionalTax({
              state,
              gross: line.gross,
              month,
              gender,
              asOf: periodStart,
              priorGross: priorPT?.get(line.employee ?? -1)?.gross ?? 0,
              priorDeducted: priorPT?.get(line.employee ?? -1)?.ptDeducted ?? 0,
            })
      snapshot.pt = pt
      if (pt > 0) {
        extra.push({
          label: 'Professional Tax',
          amount: pt,
          account: acct(settings.ptPayableAccount),
        })
      }
    }

    /* Labour Welfare Fund */
    if (settings.lwfEnabled && state && !emp?.lwfExempt) {
      const lwf = computeLWF({ state, month })
      if (lwf) {
        snapshot.lwf = lwf
        if (lwf.employee > 0) {
          extra.push({
            label: 'Labour Welfare Fund',
            amount: lwf.employee,
            account: acct(settings.lwfPayableAccount),
          })
        }
        addContribution('LWF (Employer)', lwf.employer, acct(settings.lwfPayableAccount))
      }
    }

    /* TDS — monthly instalment of the projected annual tax. */
    if (settings.tdsEnabled && line.gross > 0) {
      const regime = emp?.taxRegime === 'old' ? 'old' : 'new'
      const tax = computeIncomeTax({ annualIncome: round2(line.gross * 12), regime })
      if (tax.monthlyTDS > 0) {
        snapshot.tds = tax.monthlyTDS
        extra.push({
          label: 'TDS',
          amount: tax.monthlyTDS,
          account: acct(settings.tdsPayableAccount),
        })
      }
    }

    const deductions = [...line.deductions, ...extra]
    const net = round2(
      line.gross - deductions.reduce((s, d) => s + d.amount, 0),
    )
    out.push({
      ...line,
      deductions,
      net,
      ...(Object.keys(snapshot).length > 0
        ? { statutory: snapshot as unknown as Record<string, unknown> }
        : {}),
    })
  }

  return {
    lines: out,
    employerContributions: [...contributions.values()],
  }
}
