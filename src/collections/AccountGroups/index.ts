import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

/**
 * Chart of Accounts groups — the top-level classification of GL accounts.
 *
 * Supports a tree hierarchy via the `parent` field. Each group has a type
 * (asset, liability, equity, income, expense) that determines the normal
 * balance direction.
 *
 * Defect fixes:
 * - [BUG-5] Hierarchical account groups with parent relationships
 * - [NEW]   Pre-seeded default account groups via seed endpoint
 * - [NEW]   Group code for sorting and display
 */

export const accountTypeOptions = [
  { label: 'Asset', value: 'asset' },
  { label: 'Liability', value: 'liability' },
  { label: 'Equity', value: 'equity' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
]

export const AccountGroups: CollectionConfig = {
  slug: 'account-groups',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'type', 'parent', 'tenant'],
    description: 'Classify GL accounts into groups. Supports a parent–child tree.',
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        const d = data as any
        if (!d) return data

        // Prevent self-referential parent
        if (d.parent && String(d.parent) === String(d.id)) {
          throw new Error('An account group cannot be its own parent.')
        }

        // Auto-generate code if not provided
        if (!d.code && d.name) {
          d.code = d.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 20)
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      index: true,
      admin: {
        description: 'Short code for the group (auto-generated from name if empty).',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: accountTypeOptions,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'account-groups',
      admin: {
        description: 'Parent group for hierarchical tree structure.',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Optional description of what this group contains.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Display order within the parent group.',
      },
    },
    // Optional tenant scoping — metadata only in v1, not enforced
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    },
  ],
  endpoints: [
    {
      // Seed default account groups
      path: '/seed-defaults',
      method: 'post',
      handler: async (req) => {
        if (!req.user || req.user.role !== 'super-admin') {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const defaultGroups = [
          // Assets
          { code: 'assets', name: 'Assets', type: 'asset', sortOrder: 1 },
          { code: 'current-assets', name: 'Current Assets', type: 'asset', sortOrder: 10 },
          { code: 'cash', name: 'Cash & Cash Equivalents', type: 'asset', sortOrder: 11 },
          { code: 'bank', name: 'Bank Accounts', type: 'asset', sortOrder: 12 },
          { code: 'receivables', name: 'Accounts Receivable', type: 'asset', sortOrder: 13 },
          { code: 'inventory', name: 'Inventory', type: 'asset', sortOrder: 14 },
          { code: 'prepaid', name: 'Prepaid Expenses', type: 'asset', sortOrder: 15 },
          { code: 'fixed-assets', name: 'Fixed Assets', type: 'asset', sortOrder: 20 },
          { code: 'fixed-asset-cost', name: 'Fixed Asset Cost', type: 'asset', sortOrder: 21 },
          { code: 'accum-depr', name: 'Accumulated Depreciation', type: 'asset', sortOrder: 22 },

          // Liabilities
          { code: 'liabilities', name: 'Liabilities', type: 'liability', sortOrder: 30 },
          { code: 'current-liab', name: 'Current Liabilities', type: 'liability', sortOrder: 31 },
          { code: 'payables', name: 'Accounts Payable', type: 'liability', sortOrder: 32 },
          { code: 'tax-liab', name: 'Tax Liabilities', type: 'liability', sortOrder: 33 },
          { code: 'accrued', name: 'Accrued Expenses', type: 'liability', sortOrder: 34 },
          { code: 'long-term-liab', name: 'Long-term Liabilities', type: 'liability', sortOrder: 35 },

          // Equity
          { code: 'equity', name: 'Equity', type: 'equity', sortOrder: 40 },
          { code: 'capital', name: 'Capital', type: 'equity', sortOrder: 41 },
          { code: 'retained', name: 'Retained Earnings', type: 'equity', sortOrder: 42 },

          // Income
          { code: 'income', name: 'Income', type: 'income', sortOrder: 50 },
          { code: 'sales', name: 'Sales Revenue', type: 'income', sortOrder: 51 },
          { code: 'service-income', name: 'Service Income', type: 'income', sortOrder: 52 },
          { code: 'other-income', name: 'Other Income', type: 'income', sortOrder: 53 },
          { code: 'membership-fee', name: 'Membership Fee Income', type: 'income', sortOrder: 54 },
          { code: 'donation-income', name: 'Donation Income', type: 'income', sortOrder: 55 },

          // Expenses
          { code: 'expenses', name: 'Expenses', type: 'expense', sortOrder: 60 },
          { code: 'cogs', name: 'Cost of Goods Sold', type: 'expense', sortOrder: 61 },
          { code: 'salary', name: 'Salary & Wages', type: 'expense', sortOrder: 62 },
          { code: 'rent', name: 'Rent', type: 'expense', sortOrder: 63 },
          { code: 'utilities', name: 'Utilities', type: 'expense', sortOrder: 64 },
          { code: 'office', name: 'Office Supplies', type: 'expense', sortOrder: 65 },
          { code: 'depreciation', name: 'Depreciation', type: 'expense', sortOrder: 66 },
          { code: 'other-expense', name: 'Other Expenses', type: 'expense', sortOrder: 67 },
        ]

        let created = 0
        let skipped = 0
        for (const g of defaultGroups) {
          const existing = await req.payload.find({
            collection: 'account-groups',
            where: { code: { equals: g.code } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          if (existing.docs.length > 0) {
            skipped++
            continue
          }
          await req.payload.create({
            collection: 'account-groups',
            data: g as any,
            overrideAccess: true,
          })
          created++
        }

        return Response.json({
          message: `Seeded ${created} default account groups (${skipped} already existed).`,
          created,
          skipped,
        })
      },
    },
  ],
}
