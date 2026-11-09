/**
 * Payroll Batch workflow handlers — validate, calculate, release.
 *
 * These extend the MVP PayrollRuns workflow (generate → post → void) with a
 * 6-stage batch process:
 *
 *   Draft → Validate → Calculate → Release (Submitted) → Post → Void
 *
 * Handlers are pure functions taking a PayloadRequest, unit-testable with a
 * mocked payload.
 *
 *   POST /payroll-runs/:id/validate   — pre-flight: roster active, period open, accounts configured
 *   POST /payroll-runs/:id/calculate  — run calc engine, write lines, set status=calculated
 *   POST /payroll-runs/:id/release    — set approvalStatus=Submitted, ready for posting
 */
import type { PayloadRequest } from 'payload'
import { isBillingUser, resolveScopedTenant } from '@/access/tenantScoped'
import { round2 } from '@/utilities/journalValidation'
import {
  buildPayrollLines,
  buildPayrollJournalLines,
  summarizePayroll,
  type PayrollRunLine,
} from '@/utilities/payrollCalc'
import { accId } from './shared'

function isBillingReq(req: PayloadRequest): boolean {
  return Boolean(req.user && isBillingUser(req.user))
}

function tenantValue(v: unknown): number | string | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : String(v)
}

function relId(v: unknown): number | null {
  const id = accId(v)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** Pre-flight validation before calculation. Returns { ok: true } or a list
 * of blocking errors. */
export async function validatePayrollBatch(req: PayloadRequest): Promise<Response> {
  if (!isBillingReq(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const id = req.routeParams?.id as string
    const run = (await req.payload.findByID({
      collection: 'payroll-runs',
      id,
      depth: 0,
    })) as any
    if (!run) return Response.json({ error: 'Not found' }, { status: 404 })

    const errors: string[] = []
    const warnings: string[] = []

    // 1. Roster must have at least one active employee.
    const tenant = tenantValue(resolveScopedTenant(req, run.tenant ? String(run.tenant) : undefined))
    const roster = await req.payload.find({
      collection: 'employees',
      where: { active: { equals: true } },
      limit: 1000,
      depth: 0,
    })
    const activeCount = (roster.docs || []).length
    if (activeCount === 0) {
      errors.push('No active employees on the roster — add employees before calculating payroll.')
    }

    // 2. Period must not be closed (check fiscal year status via the run's period).
    const period = String(run.period || '')
    if (period) {
      // Find the fiscal year that contains this period.
      const fyStart = `${period}-01`
      const fyEnd = `${period}-28`
      const fiscalYears = await req.payload.find({
        collection: 'fiscal-years',
        where: {
          and: [
            { startDate: { less_than_equal: fyStart } },
            { endDate: { greater_than_equal: fyEnd } },
            ...(tenant ? [{ tenant: { equals: tenant } }] : []),
          ],
        },
        limit: 10,
        depth: 0,
      })
      for (const fy of fiscalYears.docs || []) {
        if ((fy as any).status === 'closed') {
          errors.push(`Fiscal year "${(fy as any).label}" is closed — cannot calculate payroll in a closed year.`)
        }
      }
    }

    // 3. Lines must exist (generate must have been run first).
    const lines = (run.lines || []) as PayrollRunLine[]
    if (lines.length === 0) {
      errors.push('Payroll run has no lines — generate the run before calculating.')
    }

    // 4. Accounts must be configured.
    const settings = await req.payload.findGlobal({ slug: 'billing-settings', depth: 0 })
    const payrollSettings = await req.payload.findGlobal({ slug: 'payroll-settings', depth: 0 })
    if (!relId(run.expenseAccount) && !relId((settings as any).expenseAccount)) {
      errors.push('Salary expense account not configured — set it on the run or in Billing Settings.')
    }
    if (!relId(run.paymentAccount) && !relId((settings as any).cashAccount)) {
      errors.push('Payment (cash/bank) account not configured — set it on the run or in Billing Settings.')
    }

    // 5. Warn if variance from prior period is large.
    const prior = await req.payload.find({
      collection: 'payroll-runs',
      where: {
        and: [
          { period: { less_than: period } },
          { status: { not_equals: 'void' } },
          ...(tenant ? [{ tenant: { equals: tenant } }] : []),
        ],
      },
      sort: '-period',
      limit: 1,
      depth: 0,
    })
    if (prior.docs.length > 0 && lines.length > 0) {
      const priorNet = Number((prior.docs[0] as any).netPay) || 0
      const currentNet = summarizePayroll(lines).netPay
      if (priorNet > 0 && Math.abs(currentNet - priorNet) / priorNet > 0.25) {
        warnings.push(`Net pay varies by more than 25% from prior period "${prior.docs[0]?.period}" — review before posting.`)
      }
    }

    const ok = errors.length === 0
    return Response.json({
      ok,
      errors,
      warnings,
      activeEmployees: activeCount,
      lineCount: lines.length,
      period,
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}

/** Run the calculation engine over the run's lines, recompute totals, and
 * set status to 'calculated'. Does NOT post a journal entry. */
export async function calculatePayrollBatch(req: PayloadRequest): Promise<Response> {
  if (!isBillingReq(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const id = req.routeParams?.id as string
    const run = (await req.payload.findByID({
      collection: 'payroll-runs',
      id,
      depth: 0,
    })) as any
    if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
    if (run.status !== 'draft') {
      return Response.json(
        { error: `Only draft runs can be calculated (run is ${run.status}).` },
        { status: 409 },
      )
    }

    const lines = (run.lines || []) as PayrollRunLine[]
    if (lines.length === 0) {
      return Response.json(
        { error: 'Payroll run has no lines — generate first.' },
        { status: 409 },
      )
    }

    // Recompute totals from lines (idempotent).
    const totals = summarizePayroll(lines)

    // Build employer contributions from payroll settings (SSF/PF employer share).
    const payrollSettings = await req.payload.findGlobal({ slug: 'payroll-settings', depth: 0 })
    const employerContributions: Array<{ label: string; amount: number; account?: number }> = []

    const basicTotal = round2(lines.reduce((s, l) => s + (Number(l.basic) || 0), 0))
    const ssfEnabled = (payrollSettings as any)?.ssfEnabled !== false
    const pfEnabled = (payrollSettings as any)?.pfEnabled !== false
    const ssfRate = Number((payrollSettings as any)?.ssfRate || 11)
    const pfRate = Number((payrollSettings as any)?.pfRate || 10)

    if (ssfEnabled && basicTotal > 0) {
      const amount = round2(basicTotal * (ssfRate / 100))
      employerContributions.push({
        label: 'SSF Employer',
        amount,
        ...((payrollSettings as any)?.ssfPayableAccount ? { account: relId((payrollSettings as any).ssfPayableAccount) } : {}),
      })
    }
    if (pfEnabled && !ssfEnabled && basicTotal > 0) {
      const amount = round2(basicTotal * (pfRate / 100))
      employerContributions.push({
        label: 'PF Employer',
        amount,
        ...((payrollSettings as any)?.pfPayableAccount ? { account: relId((payrollSettings as any).pfPayableAccount) } : {}),
      })
    }

    const updated = await req.payload.update({
      collection: 'payroll-runs',
      id: run.id,
      data: {
        status: 'calculated',
        grossPay: totals.grossPay,
        totalDeductions: totals.totalDeductions,
        netPay: totals.netPay,
        employerContributions: employerContributions.map((c) => ({
          label: c.label,
          amount: c.amount,
          ...(c.account ? { account: c.account } : {}),
        })),
      },
    } as any)

    return Response.json({ doc: updated, totals })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}

/** Release a calculated run for approval: set approvalStatus = 'Submitted'. */
export async function releasePayrollBatch(req: PayloadRequest): Promise<Response> {
  if (!isBillingReq(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const id = req.routeParams?.id as string
    const run = (await req.payload.findByID({
      collection: 'payroll-runs',
      id,
      depth: 0,
    })) as any
    if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
    if (run.status !== 'calculated') {
      return Response.json(
        { error: `Only calculated runs can be released (run is ${run.status}).` },
        { status: 409 },
      )
    }

    const updated = await req.payload.update({
      collection: 'payroll-runs',
      id: run.id,
      data: {
        approvalStatus: 'Submitted',
      },
    } as any)

    return Response.json({ doc: updated })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}
