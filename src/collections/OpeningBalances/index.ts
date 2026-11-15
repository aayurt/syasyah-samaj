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
    // Bulk save opening balances from the wizard UI.
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

          // Validate: debits must equal credits (sum of all amounts should be ~0)
          const totalDebit = body.balances
            .filter((b) => b.amount > 0)
            .reduce((sum, b) => sum + round2(b.amount), 0)
          const totalCredit = body.balances
            .filter((b) => b.amount < 0)
            .reduce((sum, b) => sum + round2(Math.abs(b.amount)), 0)
          if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return Response.json({
              error: `Opening balances are not balanced: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}. Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`,
              totalDebit,
              totalCredit,
              difference: round2(Math.abs(totalDebit - totalCredit)),
            }, { status: 400 })
          }

          // Check fiscal year is not closed
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

          // Delete existing balances for this FY + tenant, then insert new ones
          const existing = await req.payload.find({
            collection: 'opening-balances',
            where: {
              and: [
                { fiscalYear: { equals: body.fiscalYear } },
                { tenant: { equals: body.tenant } },
              ],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })

          let saved = 0
          let skipped = 0

          // Remove existing entries
          for (const doc of existing.docs as any[]) {
            await req.payload.delete({
              collection: 'opening-balances',
              id: doc.id,
              overrideAccess: true,
            })
          }

          // Insert new entries (only non-zero balances) and capture IDs for
          // journal posting + postedToJournal flag below.
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
                postedToJournal: false,
              } as any,
              overrideAccess: true,
            })
            newDocIds.push(Number(created.id))
            saved++
          }

          // ── Post opening balances as a journal entry on the FY start date ──
          // `fy` is already fetched above (closed-year check). Reuse it.
          if (fy && newDocIds.length > 0) {
            const fyStart = (fy as any).startDate
              ? String((fy as any).startDate).slice(0, 10)
              : new Date().toISOString().slice(0, 10)
            const fyStartDate = new Date(fyStart + 'T00:00:00')
            const fyValid =
              !isNaN(fyStartDate.getTime()) &&
              fyStartDate.getFullYear() >= 1900 &&
              fyStartDate.getFullYear() <= 2100
            const fyLabel = (fy as any).label || String(body.fiscalYear)

            if (!fyValid) {
              // FY startDate is not a usable AD date (e.g. stored as BS).
              // Skip journal posting so reports never get an unparseable date.
              // Balances stay postedToJournal = false and can be re-posted later.
              return Response.json({
                message: `Opening balances saved: ${saved} accounts, ${skipped} zero-balance skipped. Journal posting skipped: invalid FY start date "${fyStart}".`,
                saved,
                skipped,
                journalPosted: false,
              })
            }

            const lines: any[] = []
            let totalDebit = 0
            let totalCredit = 0
            for (const b of body.balances) {
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

            // Absorb any sub-cent rounding residual into an equity account so
            // the entry passes the exact balance check (epsilon 0.001).
            const residual = round2(totalDebit - totalCredit)
            if (Math.abs(residual) > 0.001) {
              const equityRes = await req.payload.find({
                collection: 'gl-accounts',
                where: {
                  and: [
                    { type: { equals: 'equity' } },
                    { tenant: { equals: body.tenant } },
                  ],
                },
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              const equityAcct = equityRes.docs?.[0] as any
              if (!equityAcct) {
                return Response.json(
                  {
                    error:
                      'No equity account found to absorb opening-balance rounding residual.',
                  },
                  { status: 400 },
                )
              }
              if (residual > 0) {
                lines.push({ account: equityAcct.id, credit: residual })
              } else {
                lines.push({ account: equityAcct.id, debit: Math.abs(residual) })
              }
            }

            await req.payload.create({
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

            // Mark the saved opening balances as posted to the journal so
            // reports don't double-count them alongside the journal entry.
            for (const id of newDocIds) {
              await req.payload.update({
                collection: 'opening-balances',
                id,
                data: { postedToJournal: true } as any,
                overrideAccess: true,
              })
            }
          }

          return Response.json({
            message: `Opening balances saved: ${saved} accounts, ${skipped} zero-balance skipped.`,
            saved,
            skipped,
            totalDebit,
            totalCredit,
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Save failed' }, { status: 400 })
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
  ],
  hooks: {
    beforeValidate: [assignTenant, rejectClosedYear],
  },
}
