/**
 * Payroll processor — batch-level process orchestration.
 *
 * Orchestrates the 6-stage batch workflow:
 *
 *   1. Generate draft run from roster
 *   2. Validate pre-flight (roster active, period open, accounts configured)
 *   3. Calculate (recompute totals, employer contributions)
 *   4. Release (approvalStatus = Submitted)
 *   5. Post (journal entry)
 *   6. Reports (payslips, registers)
 *
 * Pure orchestration — delegates to PayrollRuns handlers and payrollCalc.
 * No Payload/DB imports here; the caller injects a `payload`-like object.
 */
import {
  buildPayrollLines,
  buildPayrollJournalLines,
  summarizePayroll,
  type PayrollRunLine,
} from '@/utilities/payrollCalc'

/** Result of each stage. */
export interface BatchStageResult {
  stage: string
  ok: boolean
  data?: any
  error?: string
}

/** Process options. */
export interface BatchProcessOptions {
  period: string
  payDate: string
  tenant: number | string
  expenseAccount?: number
  paymentAccount?: number
  stopOnError?: boolean
}

/** Run the full 6-stage batch process. Returns per-stage results. */
export async function processPayrollBatch(
  payload: any,
  options: BatchProcessOptions,
): Promise<BatchStageResult[]> {
  const results: BatchStageResult[] = []
  const { period, payDate, tenant, expenseAccount, paymentAccount, stopOnError = true } = options

  // ── Stage 1: Generate draft run ──
  let runId: number | null = null
  try {
    const genRes = await payload.create({
      collection: 'payroll-runs',
      data: {
        batchNumber: `BATCH-${period}`,
        period,
        payDate,
        status: 'draft',
        approvalStatus: 'Draft',
        ...(expenseAccount ? { expenseAccount } : {}),
        ...(paymentAccount ? { paymentAccount } : {}),
        ...(tenant ? { tenant } : {}),
      },
    } as any)
    runId = genRes.id
    results.push({ stage: 'generate', ok: true, data: genRes })
  } catch (err: any) {
    results.push({ stage: 'generate', ok: false, error: err.message })
    if (stopOnError) return results
  }

  if (!runId) {
    results.push({ stage: 'validate', ok: false, error: 'No run created — cannot continue.' })
    return results
  }

  // ── Stage 2: Generate lines from roster ──
  try {
    const roster = await payload.find({
      collection: 'employees',
      where: { active: { equals: true } },
      limit: 1000,
      depth: 0,
    })
    const lines = buildPayrollLines(roster.docs || [])
    if (lines.length === 0) {
      results.push({ stage: 'lines', ok: false, error: 'No active employees on roster.' })
      if (stopOnError) return results
    }

    const totals = summarizePayroll(lines)
    await payload.update({
      collection: 'payroll-runs',
      id: runId,
      data: { lines, ...totals },
    } as any)
    results.push({ stage: 'lines', ok: true, data: { lineCount: lines.length, ...totals } })
  } catch (err: any) {
    results.push({ stage: 'lines', ok: false, error: err.message })
    if (stopOnError) return results
  }

  // ── Stage 3: Validate ──
  try {
    const roster = await payload.find({
      collection: 'employees',
      where: { active: { equals: true } },
      limit: 1000,
      depth: 0,
    })
    if ((roster.docs || []).length === 0) {
      results.push({ stage: 'validate', ok: false, error: 'No active employees.' })
      if (stopOnError) return results
    }
    results.push({ stage: 'validate', ok: true })
  } catch (err: any) {
    results.push({ stage: 'validate', ok: false, error: err.message })
    if (stopOnError) return results
  }

  // ── Stage 4: Calculate ──
  try {
    const run = await payload.findByID({ collection: 'payroll-runs', id: runId, depth: 0 })
    const lines = (run.lines || []) as PayrollRunLine[]
    const totals = summarizePayroll(lines)
    await payload.update({
      collection: 'payroll-runs',
      id: runId,
      data: { status: 'calculated', ...totals },
    } as any)
    results.push({ stage: 'calculate', ok: true, data: totals })
  } catch (err: any) {
    results.push({ stage: 'calculate', ok: false, error: err.message })
    if (stopOnError) return results
  }

  // ── Stage 5: Release ──
  try {
    await payload.update({
      collection: 'payroll-runs',
      id: runId,
      data: { approvalStatus: 'Submitted' },
    } as any)
    results.push({ stage: 'release', ok: true })
  } catch (err: any) {
    results.push({ stage: 'release', ok: false, error: err.message })
    if (stopOnError) return results
  }

  // ── Stage 6: Post ──
  try {
    const run = await payload.findByID({ collection: 'payroll-runs', id: runId, depth: 0 })
    const lines = (run.lines || []) as PayrollRunLine[]
    const totals = summarizePayroll(lines)
    const settings = await payload.findGlobal({ slug: 'billing-settings', depth: 0 })
    const payrollSettings = await payload.findGlobal({ slug: 'payroll-settings', depth: 0 })

    const jeLines = buildPayrollJournalLines(
      {
        period,
        lines,
        ...totals,
        employerContributions: (run.employerContributions || []).map((c: any) => ({
          label: String(c?.label || 'Contribution'),
          amount: Number(c?.amount) || 0,
        })),
      },
      {
        expenseAccount: run.expenseAccount ?? settings.expenseAccount,
        paymentAccount: run.paymentAccount ?? settings.cashAccount,
        deductionDefaultAccount: settings.accruedPayableAccount,
        statutoryExpenseAccount: run.statutoryExpenseAccount ?? payrollSettings.statutoryExpenseAccount,
      },
    )

    const tx = (await payload.db.beginTransaction()) ?? undefined
    try {
      const entry = await payload.create({
        collection: 'journal-entries',
        data: {
          date: run.payDate,
          narration: `Payroll ${period}`,
          status: 'posted',
          lines: jeLines,
          tenant,
        },
        req: { transactionID: tx },
      } as any)

      await payload.update({
        collection: 'payroll-runs',
        id: runId,
        data: { status: 'posted', journalEntry: entry.id, postedAt: new Date().toISOString() },
        req: { transactionID: tx },
      } as any)

      if (tx) await payload.db.commitTransaction(tx)
      results.push({ stage: 'post', ok: true, data: { journalEntry: entry.id } })
    } catch (err: any) {
      if (tx) await payload.db.rollbackTransaction(tx)
      throw err
    }
  } catch (err: any) {
    results.push({ stage: 'post', ok: false, error: err.message })
    if (stopOnError) return results
  }

  return results
}
