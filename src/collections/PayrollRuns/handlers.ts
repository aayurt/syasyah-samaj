/**
 * PayrollRuns workflow endpoints (MVP payroll run).
 *
 * Handlers are exported functions taking a PayloadRequest so the workflow
 * logic (roster → lines → journal entry) is unit-testable with a mocked
 * payload — see handlers.test.ts.
 *
 *   POST /payroll-runs/generate  — draft run from the active roster
 *   POST /payroll-runs/:id/post  — post the run's journal entry (draft → posted)
 *   POST /payroll-runs/:id/void  — void run + journal entry (posted → void)
 */
import type { PayloadRequest } from 'payload'
import { isBillingUser, resolveScopedTenant } from '@/access/tenantScoped'
import { round2 } from '@/utilities/journalValidation'
import { STATE_PT_CONFIG } from '@/utilities/indiaPayroll'
import {
  buildPayrollLines,
  buildPayrollJournalLines,
  summarizePayroll,
  type PayrollRunLine,
} from '@/utilities/payrollCalc'
import {
  applyStatutoryDeductions,
  ptPriorPeriods,
  type PriorPTRow,
  type StatutoryEmployee,
} from '@/utilities/payrollStatutory'
import { accId } from './shared'

function isBillingReq(req: PayloadRequest): boolean {
  return Boolean(req.user && isBillingUser(req.user))
}

async function getSettings(payload: PayloadRequest['payload']) {
  try {
    return (await payload.findGlobal({ slug: 'billing-settings', depth: 0 })) as any
  } catch {
    return {}
  }
}

async function getPayrollSettings(payload: PayloadRequest['payload']) {
  try {
    return (await payload.findGlobal({ slug: 'payroll-settings', depth: 0 })) as any
  } catch {
    return {}
  }
}

/** Numeric id for a relationship value that may be a populated object. */
function relId(v: unknown): number | null {
  const id = accId(v)
  return Number.isFinite(id) && id > 0 ? id : null
}

function tenantValue(v: unknown): number | string | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : String(v)
}

/**
 * Create a draft payroll run for `period` (YYYY-MM) from the active roster.
 * Money math lives in payrollCalc — the server is the single source of truth
 * for lines and totals; the SPA just renders what comes back.
 */
export async function generatePayrollRun(req: PayloadRequest): Promise<Response> {
  if (!isBillingReq(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = ((await req.json?.()) || {}) as {
      period?: unknown
      payDate?: unknown
      tenant?: unknown
      expenseAccount?: unknown
      paymentAccount?: unknown
    }
    const period = typeof body.period === 'string' ? body.period.trim() : ''
    if (!period) {
      return Response.json({ error: 'Period is required (YYYY-MM).' }, { status: 400 })
    }

    const tenant = tenantValue(resolveScopedTenant(req, body.tenant == null ? null : String(body.tenant)))

    // Active roster only.
    const roster = await req.payload.find({
      collection: 'employees',
      where: { active: { equals: true } },
      limit: 1000,
      depth: 0,
    })
    const lines = buildPayrollLines((roster.docs || []) as any[])
    if (lines.length === 0) {
      return Response.json(
        { error: 'No active employees on the roster — add employees first.' },
        { status: 400 },
      )
    }

    // One non-void run per period (per tenant when scoped).
    const existing = await req.payload.find({
      collection: 'payroll-runs',
      where: {
        and: [
          { period: { equals: period } },
          { status: { not_equals: 'void' } },
          ...(tenant ? [{ tenant: { equals: tenant } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
    })
    if ((existing.docs || []).length > 0) {
      return Response.json(
        { error: `A payroll run for ${period} already exists. Void or delete it first.` },
        { status: 409 },
      )
    }

    // India-payroll statutory layer: EPF/ESI/PT/LWF/TDS per the payroll
    // settings toggles. Periodic-frequency PT states (half-yearly/yearly)
    // need each employee's cumulative gross + PT inside the current window,
    // read from prior non-void runs.
    const payrollSettings = await getPayrollSettings(req.payload)
    const rosterDocs = (roster.docs || []) as any[]
    const empMap = new Map<number | string, StatutoryEmployee>()
    for (const doc of rosterDocs) {
      if (doc?.id != null) empMap.set(doc.id, doc)
    }
    let priorPT: Map<number | string, PriorPTRow> | undefined
    if (payrollSettings.professionalTaxEnabled) {
      const priorPeriods = new Set<string>()
      for (const doc of rosterDocs) {
        const st = doc.employmentState || payrollSettings.defaultEmploymentState
        const freq = st ? STATE_PT_CONFIG[st]?.frequency : undefined
        if (freq && freq !== 'monthly') {
          ptPriorPeriods(freq, period).forEach((p) => priorPeriods.add(p))
        }
      }
      if (priorPeriods.size > 0) {
        const priorRuns = await req.payload.find({
          collection: 'payroll-runs',
          where: {
            and: [
              { period: { in: [...priorPeriods] } },
              { status: { not_equals: 'void' } },
              ...(tenant ? [{ tenant: { equals: tenant } }] : []),
            ],
          },
          limit: 100,
          depth: 0,
        })
        priorPT = new Map()
        for (const run of priorRuns.docs || []) {
          for (const l of (run as any).lines || []) {
            if (l?.employee == null) continue
            const row = priorPT.get(l.employee) || { gross: 0, ptDeducted: 0 }
            row.gross = round2(row.gross + (Number(l.gross) || 0))
            const ptRow = (l.deductions || []).find(
              (d: any) => d?.label === 'Professional Tax',
            )
            row.ptDeducted = round2(row.ptDeducted + (Number(ptRow?.amount) || 0))
            priorPT.set(l.employee, row)
          }
        }
      }
    }
    const statutory = applyStatutoryDeductions(
      lines,
      empMap,
      payrollSettings,
      period,
      priorPT,
    )

    const totals = summarizePayroll(statutory.lines)
    const settings = await getSettings(req.payload)

    const data = {
      runNumber: `PR-${period}`,
      period,
      payDate:
        typeof body.payDate === 'string' && body.payDate
          ? body.payDate
          : new Date().toISOString().slice(0, 10),
      status: 'draft' as const,
      lines: statutory.lines,
      ...totals,
      employerContributions: statutory.employerContributions.map((c) => ({
        label: c.label,
        amount: c.amount,
        ...(c.account ? { account: c.account } : {}),
      })),
      expenseAccount: relId(body.expenseAccount) ?? relId(settings.expenseAccount),
      paymentAccount: relId(body.paymentAccount) ?? relId(settings.cashAccount),
      statutoryExpenseAccount:
        relId(payrollSettings.statutoryExpenseAccount) ??
        relId(settings.expenseAccount),
      ...(tenant ? { tenant } : {}),
    }

    const doc = await req.payload.create({ collection: 'payroll-runs', data } as any)
    return Response.json({ doc })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}

/**
 * Post a draft run: recompute totals from its lines, build the journal entry
 * via payrollCalc, and persist run + entry in one transaction.
 *
 *   Dr. Salaries Expense            grossPay
 *       Cr. Deduction accounts      (grouped by account)
 *       Cr. Cash / Bank             netPay
 */
export async function postPayrollRun(req: PayloadRequest): Promise<Response> {
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
        { error: `Only draft payroll runs can be posted (run is ${run.status}).` },
        { status: 409 },
      )
    }
    const lines = (run.lines || []) as PayrollRunLine[]
    if (lines.length === 0) {
      return Response.json(
        { error: 'Payroll run has no lines — nothing to post.' },
        { status: 409 },
      )
    }

    // Accounts are fixed on the run at generate time (posted = what was
    // previewed). Only the deduction fallback comes from settings.
    const settings = await getSettings(req.payload)
    const totals = summarizePayroll(lines)
    const jeLines = buildPayrollJournalLines(
      {
        period: String(run.period || ''),
        lines,
        ...totals,
        employerContributions: (run.employerContributions || []).map(
          (c: any) => ({
            label: String(c?.label || 'Contribution'),
            amount: Number(c?.amount) || 0,
            account: relId(c?.account),
          }),
        ),
      },
      {
        expenseAccount: relId(run.expenseAccount),
        paymentAccount: relId(run.paymentAccount),
        deductionDefaultAccount: relId(settings.accruedPayableAccount),
        statutoryExpenseAccount: relId(run.statutoryExpenseAccount),
      },
    )

    const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
    try {
      const entry = await req.payload.create({
        collection: 'journal-entries',
        data: {
          date: run.payDate || new Date().toISOString().slice(0, 10),
          narration: `Payroll ${run.period} — ${lines.length} employee(s)`,
          status: 'posted',
          lines: jeLines,
          tenant: run.tenant,
        },
        req: { transactionID },
      } as any)

      const updated = await req.payload.update({
        collection: 'payroll-runs',
        id: run.id,
        data: {
          status: 'posted',
          postedAt: new Date().toISOString(),
          postedBy: (req.user as any)?.email || 'system',
          journalEntry: entry.id,
        },
        req: { transactionID },
      } as any)

      if (transactionID) await req.payload.db.commitTransaction(transactionID)
      return Response.json({ doc: updated, journalEntry: entry.id })
    } catch (err) {
      if (transactionID) await req.payload.db.rollbackTransaction(transactionID)
      throw err
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}

/** Void a posted run and its journal entry in one transaction. */
export async function voidPayrollRun(req: PayloadRequest): Promise<Response> {
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
    if (run.status !== 'posted') {
      return Response.json(
        { error: `Only posted payroll runs can be voided (run is ${run.status}).` },
        { status: 409 },
      )
    }

    const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
    try {
      const updated = await req.payload.update({
        collection: 'payroll-runs',
        id: run.id,
        data: { status: 'void', voidedAt: new Date().toISOString() },
        req: { transactionID },
      } as any)

      if (run.journalEntry) {
        await req.payload.update({
          collection: 'journal-entries',
          id: accId(run.journalEntry),
          data: { status: 'void' },
          req: { transactionID },
        } as any)
      }

      if (transactionID) await req.payload.db.commitTransaction(transactionID)
      return Response.json({ doc: updated })
    } catch (err) {
      if (transactionID) await req.payload.db.rollbackTransaction(transactionID)
      throw err
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 })
  }
}
