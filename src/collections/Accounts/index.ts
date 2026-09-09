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
    // ── POST /api/gl-accounts/seed-defaults ───────────────────────────
    // Seed a standard chart of accounts for a tenant.
    {
      path: '/seed-defaults',
      method: 'post',
      handler: async (req) => {
        if (!req.user || req.user.role !== 'super-admin') {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as { tenant: number }
          if (!body.tenant) {
            return Response.json({ error: 'tenant is required.' }, { status: 400 })
          }
          const tenant = body.tenant

          // Default accounts grouped by type
          const defaults = [
            // Assets
            { code: '1001', name: 'Cash on Hand', type: 'asset', class: 'cash', group: 'Cash & Cash Equivalents' },
            { code: '1002', name: 'Petty Cash', type: 'asset', class: 'cash', group: 'Cash & Cash Equivalents' },
            { code: '1101', name: 'Bank Account', type: 'asset', class: 'bank', group: 'Bank Accounts' },
            { code: '1201', name: 'Accounts Receivable', type: 'asset', class: 'other', group: 'Accounts Receivable' },
            { code: '1301', name: 'Inventory', type: 'asset', class: 'other', group: 'Inventory' },
            { code: '1401', name: 'Prepaid Expenses', type: 'asset', class: 'other', group: 'Prepaid Expenses' },
            { code: '1501', name: 'Fixed Assets', type: 'asset', class: 'other', group: 'Fixed Asset Cost' },
            { code: '1502', name: 'Accumulated Depreciation', type: 'asset', class: 'other', group: 'Accumulated Depreciation' },

            // Liabilities
            { code: '2001', name: 'Accounts Payable', type: 'liability', class: 'other', group: 'Accounts Payable' },
            { code: '2101', name: 'VAT Payable', type: 'liability', class: 'other', group: 'Tax Liabilities' },
            { code: '2201', name: 'Accrued Expenses', type: 'liability', class: 'other', group: 'Accrued Expenses' },
            { code: '2301', name: 'Long-term Loan', type: 'liability', class: 'other', group: 'Long-term Liabilities' },

            // Equity
            { code: '3001', name: 'Capital', type: 'equity', class: 'other', group: 'Capital' },
            { code: '3101', name: 'Retained Earnings', type: 'equity', class: 'other', group: 'Retained Earnings' },

            // Income
            { code: '4001', name: 'Sales Revenue', type: 'income', class: 'other', group: 'Sales Revenue' },
            { code: '4101', name: 'Service Income', type: 'income', class: 'other', group: 'Service Income' },
            { code: '4201', name: 'Other Income', type: 'income', class: 'other', group: 'Other Income' },
            { code: '4301', name: 'Membership Fee Income', type: 'income', class: 'other', group: 'Membership Fee Income' },
            { code: '4401', name: 'Donation Income', type: 'income', class: 'other', group: 'Donation Income' },

            // Expenses
            { code: '5001', name: 'Cost of Goods Sold', type: 'expense', class: 'other', group: 'Cost of Goods Sold' },
            { code: '5101', name: 'Salary & Wages', type: 'expense', class: 'other', group: 'Salary & Wages' },
            { code: '5201', name: 'Rent', type: 'expense', class: 'other', group: 'Rent' },
            { code: '5301', name: 'Utilities', type: 'expense', class: 'other', group: 'Utilities' },
            { code: '5401', name: 'Office Supplies', type: 'expense', class: 'other', group: 'Office Supplies' },
            { code: '5501', name: 'Depreciation', type: 'expense', class: 'other', group: 'Depreciation' },
            { code: '5601', name: 'Other Expenses', type: 'expense', class: 'other', group: 'Other Expenses' },
            { code: '5701', name: 'Sales Returns', type: 'expense', class: 'other', group: 'Other Expenses' },
          ]

          let created = 0
          let skipped = 0
          for (const acct of defaults) {
            const existing = await req.payload.find({
              collection: 'gl-accounts',
              where: { code: { equals: acct.code } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (existing.docs.length > 0) {
              skipped++
              continue
            }
            // Find the group
            const groupRes = await req.payload.find({
              collection: 'account-groups',
              where: { code: { equals: acct.group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            await req.payload.create({
              collection: 'gl-accounts',
              data: {
                code: acct.code,
                name: acct.name,
                type: acct.type,
                class: acct.class,
                group: (groupRes.docs[0] as any)?.id || null,
                openingBalance: 0,
                active: true,
                tenant,
              } as any,
              overrideAccess: true,
            })
            created++
          }

          return Response.json({
            message: `Seeded ${created} default accounts (${skipped} already existed).`,
            created,
            skipped,
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Seed failed' }, { status: 400 })
        }
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
