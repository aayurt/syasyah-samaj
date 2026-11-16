import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'
import { resolveScopedTenant } from '@/access/tenantScoped'
import { isBillingUser } from '@/access/tenantScoped'
import { toNum, round2 } from '@/utilities/journalValidation'
import { validateOpeningBatch } from '@/utilities/accountingValidation'

/**
 * P4 company-level opening balances, tied to a fiscal year.
 *
 * Each record is the opening balance of one GL account at the start of one
 * fiscal year for one tenant. The Opening Balances wizard in the SPA writes
 * these per selected fiscal year, so the "what the books opened with" for
 * each period is captured independently of the point-in-time COA default
 * (`gl-accounts.openingBalance`), keeping cooperation setup (the wizard)
 * and per-party opening balances (set when the party is created) as separate
 * concerns.
 *
 * Amounts are signed by account type: assets/expenses carry debit-positive
 * values, liabilities/equity/income credit-positive. A helper endpoint
 * returns the net opening balance per account for the requested fiscal year.
 */
/**
 * Collection-level guard: opening balances cannot be written for a closed
 * fiscal year. Defense in depth — the save-wizard endpoint also checks this
 * before mutating, but the hook protects any write path.
 */
async function rejectClosedYear({ data, req }: any): Promise<void> {
  const fyId = data?.fiscalYear
  if (!fyId) return
  const fy = await req.payload.findByID({
    collection: 'fiscal-years',
    id: fyId,
    depth: 0,
    overrideAccess: true,
  })
  if (fy && (fy as any).status === 'closed') {
    throw new Error('Cannot write opening balances for a closed fiscal year.')
  }
}

export const OpeningBalances: CollectionConfig = {
  slug: 'opening-balances',
  labels: { singular: 'Opening Balance', plural: 'Opening Balances' },
  admin: {
    useAsTitle: 'id',
    group: 'Billing',
    defaultColumns: ['fiscalYear', 'account', 'amount', 'tenant', 'updatedAt'],
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin' || user.role === 'admin') return false
      return true
    },
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Net opening balance per account for a fiscal year (or all years when
      // no year is given). Used by the wizard to prefill the grid and by
      // reports that need an FY's opening position.
      path: '/for-year',
      method: 'get',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const year = searchParams.get('fiscalYear')
          ? Number(searchParams.get('fiscalYear'))
          : undefined

        const where: any = {}
        if (tenant) where.tenant = { equals: tenant }
        if (year) where.fiscalYear = { equals: year }

        const res = await req.payload.find({
          collection: 'opening-balances',
          where,
          limit: 1000,
          depth: 0,
        })
        const docs = (res.docs as any[]).map((d) => ({
          id: d.id,
          account: d.account,
          fiscalYear: d.fiscalYear,
          amount: round2(toNum(d.amount)),
        }))
        return Response.json({ docs, total: docs.length })
      },
    },
    // ── POST /api/opening-balances/save-wizard ────────────────────────
    // Save opening balances as DRAFT only. No journal posting here — posting
    // is a separate atomic step via /post.
    {
      path: '/save-wizard',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as {
            fiscalYear: number
            tenant: number
            balances: Array<{ account: number; amount: number }>
          }
          if (!body.fiscalYear || !body.tenant || !Array.isArray(body.balances)) {
            return Response.json({ error: 'fiscalYear, tenant, and balances array are required.' }, { status: 400 })
          }

          // Field-level validation via the centralized service.
          const batchValidation = validateOpeningBatch({
            lines: body.balances.map((b) => ({ accountId: b.account, amount: b.amount })),
            fiscalYearStatus: undefined,
            existingBatch: undefined,
            postingAllowed: false,
          })
          if (!batchValidation.valid) {
            return Response.json({ error: batchValidation.issues.map((i) => i.message).join(' '), issues: batchValidation.issues }, { status: 400 })
          }

          // Check fiscal year is not closed.
          const fy = await req.payload.findByID({
            collection: 'fiscal-years',
            id: body.fiscalYear,
            depth: 0,
            overrideAccess: true,
          })
          if (!fy) {
            return Response.json({ error: 'Fiscal year not found.' }, { status: 404 })
          }
          if ((fy as any).status === 'closed') {
            return Response.json({ error: 'Cannot set opening balances for a closed fiscal year.' }, { status: 400 })
          }

          // Reject if a posted batch already exists for this FY + tenant.
          const posted = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
                { status: { equals: 'posted' } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (posted.totalDocs > 0) {
            return Response.json({
              error: 'A posted opening-balance batch already exists for this fiscal year. Use the reversal workflow instead.',
            }, { status: 400 })
          }

          // Remove existing non-posted balances for this FY + tenant (drafts only).
          const existing = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
                { status: { not_equals: 'posted' } },
              ],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })

          for (const doc of existing.docs as any[]) {
            await req.payload.delete({
              collection: 'opening-balances',
              id: doc.id,
              overrideAccess: true,
            })
          }

          const userId = (req.user as any)?.id ?? null

          // Insert new entries (only non-zero balances) as DRAFT.
          let saved = 0
          let skipped = 0
          const newDocIds: number[] = []
          for (const b of body.balances) {
            if (Math.abs(b.amount) < 0.01) {
              skipped++
              continue
            }
            const created = await req.payload.create({
              collection: 'opening-balances',
              data: {
                account: b.account,
                fiscalYear: body.fiscalYear,
                amount: round2(b.amount),
                tenant: body.tenant,
                status: 'draft',
                postedToJournal: false,
                createdBy: userId,
                updatedBy: userId,
              } as any,
              overrideAccess: true,
            })
            newDocIds.push(Number(created.id))
            saved++
          }

          return Response.json({
            message: `Opening balances saved: ${saved} accounts, ${skipped} zero-balance skipped. Status: draft (not yet posted).`,
            saved,
            skipped,
            ids: newDocIds,
            status: 'draft',
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Save failed' }, { status: 400 })
        }
      },
    },
    // ── POST /api/opening-balances/approve ────────────────────────────
    // Approve a draft batch: status draft → approved.
    {
      path: '/approve',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as { fiscalYear: number; tenant: number }
          if (!body.fiscalYear || !body.tenant) {
            return Response.json({ error: 'fiscalYear and tenant are required.' }, { status: 400 })
          }

          const drafts = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
                { status: { equals: 'draft' } },
              ],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })

          if (drafts.totalDocs === 0) {
            return Response.json({ error: 'No draft opening balances found for this fiscal year.' }, { status: 400 })
          }

          const userId = (req.user as any)?.id ?? null
          const now = new Date().toISOString()
          let approved = 0
          for (const doc of drafts.docs as any[]) {
            await req.payload.update({
              collection: 'opening-balances',
              id: doc.id,
              data: {
                status: 'approved',
                approvedBy: userId,
                approvedAt: now,
                updatedBy: userId,
              } as any,
              overrideAccess: true,
            })
            approved++
          }

          return Response.json({ message: `Approved ${approved} opening-balance records.`, approved, status: 'approved' })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Approve failed' }, { status: 400 })
        }
      },
    },
    // ── POST /api/opening-balances/post ───────────────────────────────
    // Atomic post: create the opening journal entry AND mark all approved
    // balances as posted. If journal creation fails, nothing is marked.
    {
      path: '/post',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as { fiscalYear: number; tenant: number }
          if (!body.fiscalYear || !body.tenant) {
            return Response.json({ error: 'fiscalYear and tenant are required.' }, { status: 400 })
          }

          const fy = await req.payload.findByID({
            collection: 'fiscal-years',
            id: body.fiscalYear,
            depth: 0,
            overrideAccess: true,
          })
          if (!fy) {
            return Response.json({ error: 'Fiscal year not found.' }, { status: 404 })
          }
          if ((fy as any).status === 'closed') {
            return Response.json({ error: 'Cannot post opening balances for a closed fiscal year.' }, { status: 400 })
          }

          const approved = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
                { status: { equals: 'approved' } },
              ],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })

          if (approved.totalDocs === 0) {
            return Response.json({ error: 'No approved opening balances found for this fiscal year.' }, { status: 400 })
          }

          const fyStart = (fy as any).startDate
            ? String((fy as any).startDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10)
          const fyStartDate = new Date(fyStart + 'T00:00:00')
          const fyValid = !isNaN(fyStartDate.getTime()) && fyStartDate.getFullYear() >= 1900 && fyStartDate.getFullYear() <= 2100
          const fyLabel = (fy as any).label || String(body.fiscalYear)
          if (!fyValid) {
            return Response.json({ error: `Invalid FY start date "${fyStart}". Cannot post journal.` }, { status: 400 })
          }

          const userId = (req.user as any)?.id ?? null
          const now = new Date().toISOString()

          // Build journal lines from approved balances.
          const lines: any[] = []
          let totalDebit = 0
          let totalCredit = 0
          for (const b of approved.docs as any[]) {
            const amount = round2(Number(b.amount))
            if (Math.abs(amount) < 0.01) continue
            if (amount > 0) {
              lines.push({ account: b.account, debit: amount })
              totalDebit += amount
            } else {
              lines.push({ account: b.account, credit: Math.abs(amount) })
              totalCredit += Math.abs(amount)
            }
          }

          const residual = round2(totalDebit - totalCredit)
          if (Math.abs(residual) > 0.001) {
            const equityRes = await req.payload.find({
              collection: 'gl-accounts',
              where: { and: [{ type: { equals: 'equity' } }, { tenant: { equals: body.tenant } }] },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            const equityAcct = equityRes.docs?.[0] as any
            if (!equityAcct) {
              return Response.json({ error: 'No equity account found to absorb opening-balance rounding residual.' }, { status: 400 })
            }
            if (residual > 0) {
              lines.push({ account: equityAcct.id, credit: residual })
            } else {
              lines.push({ account: equityAcct.id, debit: Math.abs(residual) })
            }
          }

          // Create the journal entry (the write that must succeed before we mark balances).
          const journal = await req.payload.create({
            collection: 'journal-entries',
            data: {
              date: fyStart,
              narration: `Opening balances — ${fyLabel}`,
              status: 'posted',
              tenant: body.tenant,
              lines,
            } as any,
            overrideAccess: true,
          })

          // Mark all approved balances as posted (atomic with the journal entry above).
          let posted = 0
          const newDocIds: number[] = []
          for (const doc of approved.docs as any[]) {
            await req.payload.update({
              collection: 'opening-balances',
              id: doc.id,
              data: {
                status: 'posted',
                postedToJournal: true,
                postedBy: userId,
                postedAt: now,
                updatedBy: userId,
              } as any,
              overrideAccess: true,
            })
            newDocIds.push(Number(doc.id))
            posted++
          }

          return Response.json({
            message: `Posted ${posted} opening-balance records as journal entry ${journal.id}.`,
            posted,
            journalId: journal.id,
            status: 'posted',
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Post failed' }, { status: 400 })
        }
      },
    },
    // ── POST /api/opening-balances/reverse ────────────────────────────
    // Reverse a posted batch: create a reversal journal entry (debit/credit
    // swapped) and mark originals as reversed. Self-references via sourceBatch.
    {
      path: '/reverse',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as { fiscalYear: number; tenant: number; reason?: string }
          if (!body.fiscalYear || !body.tenant) {
            return Response.json({ error: 'fiscalYear and tenant are required.' }, { status: 400 })
          }

          const posted = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
                { status: { equals: 'posted' } },
              ],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })

          if (posted.totalDocs === 0) {
            return Response.json({ error: 'No posted opening balances found for this fiscal year.' }, { status: 400 })
          }

          const fy = await req.payload.findByID({
            collection: 'fiscal-years',
            id: body.fiscalYear,
            depth: 0,
            overrideAccess: true,
          })
          if (!fy) {
            return Response.json({ error: 'Fiscal year not found.' }, { status: 404 })
          }
          const fyStart = (fy as any).startDate
            ? String((fy as any).startDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10)
          const fyLabel = (fy as any).label || String(body.fiscalYear)

          const userId = (req.user as any)?.id ?? null
          const now = new Date().toISOString()

          // Build reversal journal lines (swap debit/credit).
          const lines: any[] = []
          let totalDebit = 0
          let totalCredit = 0
          for (const b of posted.docs as any[]) {
            const amount = round2(Number(b.amount))
            if (Math.abs(amount) < 0.01) continue
            if (amount > 0) {
              // Original was a debit → reversal credits it.
              lines.push({ account: b.account, credit: amount })
              totalCredit += amount
            } else {
              // Original was a credit → reversal debits it.
              lines.push({ account: b.account, debit: Math.abs(amount) })
              totalDebit += Math.abs(amount)
            }
          }

          const reversalJournal = await req.payload.create({
            collection: 'journal-entries',
            data: {
              date: fyStart,
              narration: `Reversal of opening balances — ${fyLabel}`,
              status: 'posted',
              tenant: body.tenant,
              lines,
            } as any,
            overrideAccess: true,
          })

          // Mark originals as reversed + create reversal records linked via sourceBatch.
          let reversed = 0
          for (const doc of posted.docs as any[]) {
            const amount = round2(Number(doc.amount))
            if (Math.abs(amount) < 0.01) continue

            // Mark original reversed.
            await req.payload.update({
              collection: 'opening-balances',
              id: doc.id,
              data: {
                status: 'reversed',
                reversedBy: userId,
                reversedAt: now,
                reversalReason: body.reason ?? '',
                updatedBy: userId,
              } as any,
              overrideAccess: true,
            })

            // Create the mirror reversal record so the ledger stays complete.
            await req.payload.create({
              collection: 'opening-balances',
              data: {
                account: doc.account,
                fiscalYear: body.fiscalYear,
                amount: -amount, // sign-flipped mirror
                tenant: body.tenant,
                status: 'posted',
                postedToJournal: true,
                postedBy: userId,
                postedAt: now,
                sourceBatch: doc.id,
                createdBy: userId,
                updatedBy: userId,
              } as any,
              overrideAccess: true,
            })

            reversed++
          }

          return Response.json({
            message: `Reversed ${reversed} opening-balance records as journal entry ${reversalJournal.id}.`,
            reversed,
            journalId: reversalJournal.id,
            status: 'reversed',
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Reverse failed' }, { status: 400 })
        }
      },
    },
    // ── GET /api/opening-balances/validate ────────────────────────────
    // Check if opening balances are balanced for a fiscal year.
    {
      path: '/validate',
      method: 'get',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const year = searchParams.get('fiscalYear')
          ? Number(searchParams.get('fiscalYear'))
          : undefined

        if (!year) {
          return Response.json({ error: 'fiscalYear parameter is required.' }, { status: 400 })
        }

        const where: any = { fiscalYear: { equals: year } }
        if (tenant) where.tenant = { equals: tenant }

        const res = await req.payload.find({
          collection: 'opening-balances',
          where,
          limit: 1000,
          depth: 0,
        })

        const totalDebit = (res.docs as any[])
          .filter((d) => toNum(d.amount) > 0)
          .reduce((sum, d) => sum + round2(toNum(d.amount)), 0)
        const totalCredit = (res.docs as any[])
          .filter((d) => toNum(d.amount) < 0)
          .reduce((sum, d) => sum + round2(Math.abs(toNum(d.amount))), 0)

        const balanced = Math.abs(totalDebit - totalCredit) <= 0.01
        return Response.json({
          balanced,
          totalDebit: round2(totalDebit),
          totalCredit: round2(totalCredit),
          difference: round2(Math.abs(totalDebit - totalCredit)),
          accountCount: (res.docs as any[]).length,
        })
      },
    },
  ],
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'gl-accounts',
      required: true,
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Opening balance for this account at the start of the fiscal year (signed by account type).',
      },
    },
    // Flag: true once this balance has been posted as a journal entry on the
    // fiscal-year start date. Prevents double-counting in reports when the
    // opening balance is both a journal entry (posted on FY start) and added
    // directly for mid-year ranges where `from` is after FY start.
    {
      name: 'postedToJournal',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
    // Workflow status: draft → approved → posted → reversed.
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'approved', 'posted', 'reversed'],
      defaultValue: 'draft',
      required: true,
      admin: { position: 'sidebar' },
    },
    // Audit trail — who touched this balance and when.
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      name: 'approvedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'postedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      name: 'postedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'reversedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
    {
      name: 'reversedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'reversalReason',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    // Self-reference: links a reversal batch to the original posted batch.
    {
      name: 'sourceBatch',
      type: 'relationship',
      relationTo: 'opening-balances',
      admin: { position: 'sidebar' },
    },
  ],
  hooks: {
    beforeValidate: [assignTenant, rejectClosedYear],
  },
}
