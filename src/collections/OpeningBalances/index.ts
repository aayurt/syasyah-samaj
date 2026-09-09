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

          // Insert new entries (only non-zero balances)
          for (const b of body.balances) {
            if (Math.abs(b.amount) < 0.01) {
              skipped++
              continue
            }
            await req.payload.create({
              collection: 'opening-balances',
              data: {
                account: b.account,
                fiscalYear: body.fiscalYear,
                amount: round2(b.amount),
                tenant: body.tenant,
              } as any,
              overrideAccess: true,
            })
            saved++
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
    beforeValidate: [assignTenant],
  },
}
