import { round2, toNum } from './journalValidation'

/**
 * Payroll calculation core (MVP payroll run).
 *
 * Pure functions — no Payload, no DB — so the same math is used by the
 * payroll-runs collection (generate/post endpoints) and can be unit-tested
 * in isolation. Money is always rounded to 2 decimals at each step.
 */

export interface PayrollEarning {
  label: string
  amount: number
}

export interface PayrollDeduction {
  label: string
  amount: number
  account?: number | null
}

/** Roster shape accepted by the calculator (an Employee document or a draft). */
export interface PayrollCalcEmployee {
  id?: number | string
  employeeId?: string
  name: string
  active?: boolean
  basicSalary?: number | string | null
  allowances?: Array<{ label?: string; amount?: number | string | null }> | null
  deductions?:
    | Array<{ label?: string; amount?: number | string | null; account?: number | null }>
    | null
}

/** One employee's computed row inside a payroll run. */
export interface PayrollRunLine {
  employee: number | null
  /** Snapshot of the employee's code at run time (named empCode so it does
   *  not collide with the `employee` relationship's column). */
  empCode: string
  name: string
  basic: number
  allowances: PayrollEarning[]
  gross: number
  deductions: PayrollDeduction[]
  net: number
  /** India-payroll statutory snapshot (EPF/ESI/PT/LWF/TDS) — register reports read this. */
  statutory?: Record<string, unknown>
}

export interface PayrollTotals {
  grossPay: number
  totalDeductions: number
  netPay: number
}

export interface PayrollAccounts {
  /** Salaries & wages expense — required. */
  expenseAccount?: number | null
  /** Cash/bank account paying the net salaries — required. */
  paymentAccount?: number | null
  /** Fallback for deduction heads that carry no account (accrued payables). */
  deductionDefaultAccount?: number | null
  /** Dr employer statutory contributions (falls back to expenseAccount). */
  statutoryExpenseAccount?: number | null
}

/** Run-level employer contribution (EPF split, ESI employer, LWF employer). */
export interface PayrollEmployerContribution {
  label: string
  amount: number
  account?: number | null
}

export interface PayrollJournalInput extends PayrollTotals {
  period: string
  lines: PayrollRunLine[]
  /** Employer statutory contributions accrued on top of gross pay. */
  employerContributions?: PayrollEmployerContribution[]
}

/**
 * Compute one payroll line per active roster member.
 * Inactive employees are excluded; junk amounts are treated as 0.
 */
export function buildPayrollLines(
  roster: PayrollCalcEmployee[],
): PayrollRunLine[] {
  const lines: PayrollRunLine[] = []
  for (const emp of roster) {
    if (emp.active === false) continue
    if (!emp.name) continue

    const basic = round2(toNum(emp.basicSalary))
    const allowances: PayrollEarning[] = (emp.allowances || []).map((a) => ({
      label: a.label || 'Allowance',
      amount: round2(toNum(a.amount)),
    }))
    const deductions: PayrollDeduction[] = (emp.deductions || []).map((d) => ({
      label: d.label || 'Deduction',
      amount: round2(toNum(d.amount)),
      account: d.account == null ? null : Number(d.account),
    }))

    const gross = round2(
      basic + allowances.reduce((s, a) => s + a.amount, 0),
    )
    const net = round2(
      gross - deductions.reduce((s, d) => s + d.amount, 0),
    )

    lines.push({
      employee: emp.id == null ? null : Number(emp.id),
      empCode: emp.employeeId || '',
      name: emp.name,
      basic,
      allowances,
      gross,
      deductions,
      net,
    })
  }
  return lines
}

/** Aggregate run-level totals from computed lines. */
export function summarizePayroll(lines: PayrollRunLine[]): PayrollTotals {
  const totals = lines.reduce(
    (acc, line) => {
      acc.grossPay += line.gross
      acc.totalDeductions += line.deductions.reduce((s, d) => s + d.amount, 0)
      acc.netPay += line.net
      return acc
    },
    { grossPay: 0, totalDeductions: 0, netPay: 0 },
  )
  totals.grossPay = round2(totals.grossPay)
  totals.totalDeductions = round2(totals.totalDeductions)
  totals.netPay = round2(totals.netPay)
  return totals
}

/**
 * Build the posting journal lines for a payroll run:
 *
 *   Dr. Salaries Expense                grossPay
 *   Dr. Statutory Contributions         employerContributions total
 *       Cr. Deduction accounts          (per head, grouped by account —
 *                                        includes employee EPF/ESI/PT/LWF/TDS)
 *       Cr. Employer contribution       (EPS, EPF, EDLI, ESI employer,
 *        accounts                        LWF employer — grouped by account)
 *       Cr. Cash / Bank                 netPay
 *
 * The entry is balanced by construction (the employer accrual appears on
 * both sides); throws when required accounts are missing or the run has
 * nothing to pay.
 */
export function buildPayrollJournalLines(
  run: PayrollJournalInput,
  accounts: PayrollAccounts,
): Array<{ account: number; debit?: number; credit?: number; memo?: string }> {
  if (!run.lines || run.lines.length === 0) {
    throw new Error('Payroll run has no lines — nothing to post.')
  }
  const expense = accounts.expenseAccount
  if (!expense) {
    throw new Error('Salary expense account is not configured.')
  }
  const payment = accounts.paymentAccount
  if (!payment) {
    throw new Error('Payment (cash/bank) account is not configured.')
  }

  const out: Array<{
    account: number
    debit?: number
    credit?: number
    memo?: string
  }> = [
    {
      account: Number(expense),
      debit: round2(run.grossPay),
      memo: `Salaries ${run.period}`,
    },
  ]

  // Group deduction heads by account: one credit line per account.
  const byAccount = new Map<number, { amount: number; labels: string[] }>()
  for (const line of run.lines) {
    for (const d of line.deductions) {
      if (d.amount <= 0) continue
      const acct = d.account || accounts.deductionDefaultAccount
      if (!acct) {
        throw new Error(
          `Deduction "${d.label}" has no account and no default deduction account is configured.`,
        )
      }
      const key = Number(acct)
      const entry = byAccount.get(key) || { amount: 0, labels: [] }
      entry.amount = round2(entry.amount + d.amount)
      if (d.label && !entry.labels.includes(d.label)) entry.labels.push(d.label)
      byAccount.set(key, entry)
    }
  }
  for (const [account, { amount, labels }] of byAccount) {
    out.push({ account, credit: amount, memo: labels.join(', ') })
  }

  // Employer statutory contributions: one debit on the statutory expense
  // account, credits grouped by the contribution payables.
  const contributions = (run.employerContributions || []).filter(
    (c) => c.amount > 0,
  )
  const employerTotal = round2(
    contributions.reduce((s, c) => s + c.amount, 0),
  )
  if (employerTotal > 0) {
    const statExpense = accounts.statutoryExpenseAccount || expense
    out.push({
      account: Number(statExpense),
      debit: employerTotal,
      memo: 'Employer statutory contributions',
    })
    const byContribAccount = new Map<number, { amount: number; labels: string[] }>()
    for (const c of contributions) {
      const acct = c.account || accounts.deductionDefaultAccount
      if (!acct) {
        throw new Error(
          `Employer contribution "${c.label}" has no account and no default is configured.`,
        )
      }
      const key = Number(acct)
      const entry = byContribAccount.get(key) || { amount: 0, labels: [] }
      entry.amount = round2(entry.amount + c.amount)
      if (!entry.labels.includes(c.label)) entry.labels.push(c.label)
      byContribAccount.set(key, entry)
    }
    for (const [account, { amount, labels }] of byContribAccount) {
      out.push({ account, credit: amount, memo: labels.join(', ') })
    }
  }

  out.push({
    account: Number(payment),
    credit: round2(run.netPay),
    memo: `Net salaries ${run.period}`,
  })
  return out
}
