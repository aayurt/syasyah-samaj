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
