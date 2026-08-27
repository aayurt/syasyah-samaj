import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { round2, toNum } from '@/utilities/journalValidation'

/**
 * Expense Claims (Manager.io-style).
 *
 * Employees submit expense reports with line items. Claims flow through a
 * workflow: Draft → Submitted → Approved → Reimbursed (or Rejected).
 *
 * When approved, the claim posts a journal entry:
 *   Dr. Expense (per line's account)    X
 *       Cr. Accrued Payables (or Cash)      X
 *
 * When reimbursed (paid), a second entry:
 *   Dr. Accrued Payables              X
 *       Cr. Cash / Bank                    X
 *
 * Billable Expenses: any claim or line can be marked `billable` with a
 * linked party. The SPA tracks which are unbilled, and a "Create Invoice"
 * endpoint generates a sales invoice from the billable lines.
 */

function isBillingReq(req: PayloadRequest): boolean {
  return Boolean(req.user && isBillingUser(req.user))
}

function accId(v: unknown): number {
  if (v && typeof v === 'object') return Number((v as { id: unknown }).id)
  return Number(v)
}

function vErr(message: string): Error {
  return new Error(message)
}

async function getSettings(payload: PayloadRequest['payload']) {
  try {
    return (await payload.findGlobal({ slug: 'billing-settings', depth: 0 })) as any
  } catch {
    return {}
  }
}

function resolveAccount(settings: any, key: string, label: string): number {
  const id = settings?.[key]
  if (!id) throw new Error(`"${label}" account is not configured in Billing Settings.`)
  return Number(id)
}

export const ExpenseClaims: CollectionConfig = {
  slug: 'expense-claims',
  labels: { singular: 'Expense Claim', plural: 'Expense Claims' },
  admin: {
    useAsTitle: 'claimNumber',
    group: 'Billing',
    defaultColumns: ['claimNumber', 'claimant', 'status', 'totalAmount', 'date', 'billable', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        const d = data as any
        if (!d.claimNumber && d.status === 'draft') {
          d.claimNumber = `EC-${Date.now().toString(36).toUpperCase()}`
        }
        // Compute total from lines
        const lines: any[] = d.lines || []
        d.totalAmount = round2(lines.reduce((s, l) => s + toNum(l.amount), 0))
        return data
      },
    ],
  },
  endpoints: [
    {
      // Submit a draft claim for approval.
      path: '/:id/submit',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        try {
          const doc = (await req.payload.findByID({ collection: 'expense-claims', id, depth: 0 })) as any
          if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })
          if (doc.status !== 'draft') return Response.json({ error: 'Only draft claims can be submitted' }, { status: 409 })
          const updated = await req.payload.update({
            collection: 'expense-claims', id: doc.id,
            data: { status: 'submitted', submittedAt: new Date().toISOString() },
          })
          return Response.json({ doc: updated })
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 400 })
        }
      },
    },
    {
      // Approve a submitted claim — posts journal entry.
      path: '/:id/approve',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        try {
          const doc = (await req.payload.findByID({ collection: 'expense-claims', id, depth: 0 })) as any
          if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })
          if (doc.status !== 'submitted') return Response.json({ error: 'Only submitted claims can be approved' }, { status: 409 })

          const settings = await getSettings(req.payload)
          const expenseAccount = resolveAccount(settings, 'expenseAccount', 'Expense')
          const accruedPayable = resolveAccount(settings, 'accruedPayableAccount', 'Accrued Payables')
          const lines = (doc.lines || []) as any[]

          // Build journal lines: Dr. Expense per line, Cr. Accrued Payables (total)
          const journalLines: any[] = []
          let total = 0
          for (const l of lines) {
            const amt = toNum(l.amount)
            if (amt <= 0) continue
            const acct = l.account ? accId(l.account) : expenseAccount
            journalLines.push({ account: acct, debit: amt, memo: l.description })
            total += amt
          }
          total = round2(total)
          if (total <= 0) return Response.json({ error: 'Claim has no amount' }, { status: 409 })
          journalLines.push({ account: accruedPayable, credit: total })

          const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
          try {
            const entry = await req.payload.create({
              collection: 'journal-entries',
              data: {
                date: doc.date || new Date().toISOString().slice(0, 10),
                narration: `Expense claim ${doc.claimNumber} — ${doc.claimant || 'employee'}`,
                status: 'posted',
                lines: journalLines,
                tenant: doc.tenant,
              },
              req: { transactionID },
            })

            const updated = await req.payload.update({
              collection: 'expense-claims', id: doc.id,
              data: {
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: (req.user as any)?.email || 'system',
                journalEntry: entry.id,
              },
              req: { transactionID },
            })

            if (transactionID) await req.payload.db.commitTransaction(transactionID)
            return Response.json({ doc: updated, journalEntry: entry.id })
          } catch (err) {
            if (transactionID) await req.payload.db.rollbackTransaction(transactionID)
            throw err
          }
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 400 })
        }
      },
    },
    {
      // Reject a submitted claim.
      path: '/:id/reject',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        try {
          const doc = (await req.payload.findByID({ collection: 'expense-claims', id, depth: 0 })) as any
          if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })
          if (doc.status !== 'submitted') return Response.json({ error: 'Only submitted claims can be rejected' }, { status: 409 })

          let reason = 'Rejected'
          try {
            const body = await (req as any).json?.()
            if (body?.reason) reason = body.reason
          } catch { /* */ }

          const updated = await req.payload.update({
            collection: 'expense-claims', id: doc.id,
            data: { status: 'rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason },
          })
          return Response.json({ doc: updated })
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 400 })
        }
      },
    },
    {
      // Reimburse an approved claim — posts payment journal entry.
      path: '/:id/reimburse',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        try {
          const doc = (await req.payload.findByID({ collection: 'expense-claims', id, depth: 0 })) as any
          if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })
          if (doc.status !== 'approved') return Response.json({ error: 'Only approved claims can be reimbursed' }, { status: 409 })

          const settings = await getSettings(req.payload)
          const accruedPayable = resolveAccount(settings, 'accruedPayableAccount', 'Accrued Payables')
          const bankAccount = resolveAccount(settings, 'bankAccount', 'Bank')
          const total = toNum(doc.totalAmount)

          const transactionID = (await req.payload.db.beginTransaction()) ?? undefined
          try {
            const entry = await req.payload.create({
              collection: 'journal-entries',
              data: {
                date: new Date().toISOString().slice(0, 10),
                narration: `Reimbursement — ${doc.claimNumber}`,
                status: 'posted',
                lines: [
                  { account: accruedPayable, debit: total },
                  { account: bankAccount, credit: total },
                ],
                tenant: doc.tenant,
              },
              req: { transactionID },
            })

            const updated = await req.payload.update({
              collection: 'expense-claims', id: doc.id,
              data: {
                status: 'reimbursed',
                reimbursedAt: new Date().toISOString(),
                paymentJournalEntry: entry.id,
              },
              req: { transactionID },
            })

            if (transactionID) await req.payload.db.commitTransaction(transactionID)
            return Response.json({ doc: updated, journalEntry: entry.id })
          } catch (err) {
            if (transactionID) await req.payload.db.rollbackTransaction(transactionID)
            throw err
          }
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 400 })
        }
      },
    },
    {
      // Create a sales invoice from billable expense lines for a party.
      // Finds all approved/reimbursed claims marked as billable for the given
      // party that haven't been invoiced yet, and creates a draft sales invoice.
      path: '/bill-to-customer',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        let body: any = {}
        try { body = await (req as any).json?.() } catch { /* */ }
        const partyId = body?.party
        if (!partyId) return Response.json({ error: 'party is required' }, { status: 400 })

        try {
          // Find billable, uninvoiced claims for this party
          const res = await req.payload.find({
            collection: 'expense-claims',
            where: {
              and: [
                { party: { equals: partyId } },
                { billable: { equals: true } },
                { billedInvoiceId: { exists: false } },
                { status: { in: ['approved', 'reimbursed'] } },
              ],
            },
            limit: 1000,
            depth: 0,
          })

          const claims = res.docs as any[]
          if (claims.length === 0) {
            return Response.json({ error: 'No uninvoiced billable expenses found for this party.' }, { status: 404 })
          }

          // Flatten billable lines
          const invoiceLines: any[] = []
          let netTotal = 0
          const claimIds: number[] = []
          for (const claim of claims) {
            claimIds.push(claim.id)
            for (const l of claim.lines || []) {
              if (toNum(l.amount) <= 0) continue
              invoiceLines.push({ description: l.description || claim.claimNumber, qty: 1, rate: toNum(l.amount), amount: toNum(l.amount) })
              netTotal += toNum(l.amount)
            }
          }
          netTotal = round2(netTotal)
          const taxRate = 0 // Expense pass-through typically has no tax
          const grossTotal = netTotal

          const pool = (req.payload.db as any).pool
          const tenantId = claims[0]?.tenant
            ? (typeof claims[0].tenant === 'object' ? claims[0].tenant.id : claims[0].tenant)
            : null

          const txn = await req.payload.db.beginTransaction()
          const txId = txn ?? undefined
          try {
            const inserted = await pool.query(
              `INSERT INTO documents
                 (doc_type, date, party_id, narration, status, tax_rate,
                  net_total, tax_total, gross_total, tenant_id,
                  created_at, updated_at)
               VALUES ('sales-invoice', $1, $2, $3, 'draft', $4, $5, $6, $7, $8, now(), now())
               RETURNING id`,
              [new Date().toISOString().slice(0, 10), partyId, `Billable expenses (${claims.length} claims)`, taxRate, netTotal, 0, grossTotal, tenantId],
            )
            const docId: number = inserted.rows[0].id
            let order = 0
            for (const l of invoiceLines) {
              await pool.query(
                `INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [order++, docId, `line-${docId}-${order}`, l.description, l.qty, l.rate, l.amount],
              )
            }
            if (txId) await req.payload.db.commitTransaction(txId)

            // Mark claims as billed
            for (const cid of claimIds) {
              await req.payload.update({
                collection: 'expense-claims', id: cid,
                data: { billedInvoiceId: docId },
              })
            }

            return Response.json({ invoiceId: docId, claimsCount: claimIds.length, netTotal, grossTotal })
          } catch (err) {
            if (txId) await req.payload.db.rollbackTransaction(txId)
            throw err
          }
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 400 })
        }
      },
    },
  ],
  fields: [
    {
      name: 'claimNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Auto-generated claim number' },
    },
    {
      name: 'claimant',
      type: 'text',
      required: true,
      admin: { description: 'Name or employee ID of the person submitting the claim' },
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      admin: { description: 'Claim date (YYYY-MM-DD)' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Reimbursed', value: 'reimbursed' },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, min: 0 },
        { name: 'account', type: 'relationship', relationTo: 'gl-accounts', admin: { description: 'GL expense account (defaults to global Expense)' } },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Auto-computed from lines', readOnly: true },
    },
    {
      name: 'billable',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Mark as billable to a customer' },
    },
    {
      name: 'party',
      type: 'relationship',
      relationTo: 'parties',
      admin: {
        description: 'Customer to bill (required if billable)',
        condition: (_, siblingData) => siblingData?.billable === true,
      },
    },
    {
      name: 'billedInvoiceId',
      type: 'number',
      admin: { description: 'ID of the sales invoice this was billed on (auto-set)', readOnly: true },
    },
    {
      name: 'submittedAt',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'approvedAt',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'approvedBy',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'rejectedAt',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'rejectionReason',
      type: 'text',
      admin: { condition: (_, siblingData) => siblingData?.status === 'rejected' },
    },
    {
      name: 'reimbursedAt',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'journalEntry',
      type: 'number',
      admin: { description: 'Approval journal entry', readOnly: true },
    },
    {
      name: 'paymentJournalEntry',
      type: 'number',
      admin: { description: 'Reimbursement journal entry', readOnly: true },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
}
