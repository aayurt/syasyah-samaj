import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { isBillingUser, resolveScopedTenant } from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'
import { accountTypeOptions } from '../AccountGroups'
import { sumPostedByAccount } from '@/utilities/journalSums'
import { round2, toNum } from '@/utilities/journalValidation'
import { paginate, parsePagination } from '@/utilities/pagination'

export const Accounts: CollectionConfig = {
  // NB: slug 'accounts' is taken by the better-auth plugin's account collection.
  slug: 'gl-accounts',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'group', 'type', 'class', 'openingBalance', 'active'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Net balance per account from posted journal entries plus opening
      // balance, signed by account type (assets/expenses debit-positive,
      // liabilities/equity/income credit-positive). One record per account.
      path: '/balances',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const acctRes = await req.payload.find({
          collection: 'gl-accounts',
          limit: 1000,
          depth: 0,
          where: tenant ? { tenant: { equals: tenant } } : undefined,
        })
        const accounts = acctRes.docs as any[]
        const where: any = {}
        if (tenant) where.tenant = { equals: tenant }
        const sums = await sumPostedByAccount(req.payload, where)
        const debitNormal = (t: string) =>
          t === 'asset' || t === 'expense'
        const docs: any[] = []
        for (const a of accounts) {
          const s = sums.get(Number(a.id)) || { debit: 0, credit: 0 }
          const opening = toNum(a.openingBalance)
          const balance = round2(
            opening + (debitNormal(a.type) ? s.debit - s.credit : s.credit - s.debit),
          )
          docs.push({
            account: { id: a.id, code: a.code, name: a.name },
            debit: round2(s.debit),
            credit: round2(s.credit),
            openingBalance: round2(opening),
            balance,
          })
        }
        const page = paginate(docs, parsePagination(searchParams))
        return Response.json({
          docs: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
        })
      },
    },
  ],
  fields: [
    {
      name: 'code',
      type: 'text',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'group',
      type: 'relationship',
      relationTo: 'account-groups',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: accountTypeOptions,
    },
    {
      name: 'class',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Cash/bank accounts drive the cash & bank book and reconciliation.',
      },
    },
    {
      name: 'openingBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Opening balance at the start of the books (debit positive).',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'allowManualPosting',
      type: 'checkbox',
      defaultValue: true,
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
  ],
  hooks: {
    beforeValidate: [assignTenant],
  },
}
