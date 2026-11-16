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
      async ({ data, req }) => {
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

        // Auto-compute hierarchy level from parent chain.
        if (d.parent && req?.payload) {
          const parentId = typeof d.parent === 'object' ? d.parent?.id : d.parent
          const parent = await req.payload.findByID({
            collection: 'account-groups',
            id: parentId,
            depth: 0,
            overrideAccess: true,
          })
          d.level = Number((parent as any)?.level ?? 0) + 1
        } else if (d.level == null) {
          d.level = 0
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
    {
      name: 'level',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Hierarchy level (0 = root). Auto-computed from parent chain.',
        position: 'sidebar',
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
          { code: 'current-assets', name: 'Current Assets', type: 'asset', sortOrder: 10, parentCode: 'assets' },
          { code: 'cash', name: 'Cash & Cash Equivalents', type: 'asset', sortOrder: 11, parentCode: 'current-assets' },
          { code: 'bank', name: 'Bank Accounts', type: 'asset', sortOrder: 12, parentCode: 'current-assets' },
          { code: 'receivables', name: 'Accounts Receivable', type: 'asset', sortOrder: 13, parentCode: 'current-assets' },
          { code: 'inventory', name: 'Inventory', type: 'asset', sortOrder: 14, parentCode: 'current-assets' },
          { code: 'prepaid', name: 'Prepaid Expenses', type: 'asset', sortOrder: 15, parentCode: 'current-assets' },
          { code: 'fixed-assets', name: 'Fixed Assets', type: 'asset', sortOrder: 20, parentCode: 'assets' },
          { code: 'fixed-asset-cost', name: 'Fixed Asset Cost', type: 'asset', sortOrder: 21, parentCode: 'fixed-assets' },
          { code: 'accum-depr', name: 'Accumulated Depreciation', type: 'asset', sortOrder: 22, parentCode: 'fixed-assets' },

          // Liabilities
          { code: 'liabilities', name: 'Liabilities', type: 'liability', sortOrder: 30 },
          { code: 'current-liab', name: 'Current Liabilities', type: 'liability', sortOrder: 31, parentCode: 'liabilities' },
          { code: 'payables', name: 'Accounts Payable', type: 'liability', sortOrder: 32, parentCode: 'current-liab' },
          { code: 'tax-liab', name: 'Tax Liabilities', type: 'liability', sortOrder: 33, parentCode: 'current-liab' },
          { code: 'accrued', name: 'Accrued Expenses', type: 'liability', sortOrder: 34, parentCode: 'current-liab' },
          { code: 'long-term-liab', name: 'Long-term Liabilities', type: 'liability', sortOrder: 35, parentCode: 'liabilities' },

          // Equity
          { code: 'equity', name: 'Equity', type: 'equity', sortOrder: 40 },
          { code: 'capital', name: 'Capital', type: 'equity', sortOrder: 41, parentCode: 'equity' },
          { code: 'retained', name: 'Retained Earnings', type: 'equity', sortOrder: 42, parentCode: 'equity' },

          // Income
          { code: 'income', name: 'Income', type: 'income', sortOrder: 50 },
          { code: 'sales', name: 'Sales Revenue', type: 'income', sortOrder: 51, parentCode: 'income' },
          { code: 'service-income', name: 'Service Income', type: 'income', sortOrder: 52, parentCode: 'income' },
          { code: 'other-income', name: 'Other Income', type: 'income', sortOrder: 53, parentCode: 'income' },
          { code: 'membership-fee', name: 'Membership Fee Income', type: 'income', sortOrder: 54, parentCode: 'income' },
          { code: 'donation-income', name: 'Donation Income', type: 'income', sortOrder: 55, parentCode: 'income' },

          // Expenses
          { code: 'expenses', name: 'Expenses', type: 'expense', sortOrder: 60 },
          { code: 'cogs', name: 'Cost of Goods Sold', type: 'expense', sortOrder: 61, parentCode: 'expenses' },
          { code: 'salary', name: 'Salary & Wages', type: 'expense', sortOrder: 62, parentCode: 'expenses' },
          { code: 'rent', name: 'Rent', type: 'expense', sortOrder: 63, parentCode: 'expenses' },
          { code: 'utilities', name: 'Utilities', type: 'expense', sortOrder: 64, parentCode: 'expenses' },
          { code: 'office', name: 'Office Supplies', type: 'expense', sortOrder: 65, parentCode: 'expenses' },
          { code: 'depreciation', name: 'Depreciation', type: 'expense', sortOrder: 66, parentCode: 'expenses' },
          { code: 'other-expense', name: 'Other Expenses', type: 'expense', sortOrder: 67, parentCode: 'expenses' },
        ]

        const createdByCode = new Map<string, any>()
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

          let parentId: number | null = null
          let level = 0
          if (g.parentCode) {
            const p = createdByCode.get(g.parentCode)
            if (p) {
              parentId = Number(p.id)
              level = Number((p as any).level ?? 0) + 1
            }
          }

          const createdGrp = await req.payload.create({
            collection: 'account-groups',
            data: { ...g, parent: parentId, level } as any,
            overrideAccess: true,
          })
          createdByCode.set(g.code, createdGrp)
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
