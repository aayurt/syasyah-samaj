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

/** Validate account data: no self-parent, no parent cycle, unique code within
 * tenant.
 *
 * Cycles are walked up the parent chain and bounded at 50 hops. Codes must be
 * unique per tenant (excluding the account being edited).
 *
 * ponytail: posting to an account that has children is not yet rejected here;
 * add a posting-time check (account has descendants) when headings are seeded.
 */
const validateAccount = async ({
  data,
  req,
  originalDoc,
}: {
  data?: any
  req?: any
  originalDoc?: any
}) => {
  const id = data?.id ?? originalDoc?.id
  const tenant = data?.tenant ?? originalDoc?.tenant

  // An account cannot be its own parent.
  if (data?.parent != null && id != null && data.parent === id) {
    throw new Error('An account cannot be its own parent.')
  }

  // Account codes are unique within a tenant.
  if (data?.code && req?.payload) {
    const existing = await req.payload.find({
      collection: 'gl-accounts',
      where: {
        and: [
          { code: { equals: data.code } },
          { tenant: { equals: tenant } },
          ...(id ? [{ id: { not_equals: id } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      throw new Error(`Account code "${data.code}" already exists.`)
    }
  }

  // Detect parent cycles: walk up the chain, bounded.
  if (data?.parent && req?.payload) {
    const seen = new Set<string | number>(id ? [id] : [])
    let cursor = data.parent
    let hops = 0
    while (cursor != null && hops < 50) {
      if (cursor === id || seen.has(cursor)) {
        throw new Error('Circular parent relationship detected.')
      }
      seen.add(cursor)
      const parent = await req.payload.findByID({
        collection: 'gl-accounts',
        id: cursor,
        depth: 0,
        overrideAccess: true,
      })
      // Parent must belong to the same tenant/company.
      if (tenant && (parent as any)?.tenant !== tenant) {
        throw new Error('Parent account must belong to the same company.')
      }
      cursor = parent?.parent
      hops++
    }
  }

  // Auto-compute hierarchy level from parent chain.
  if (data?.parent && req?.payload) {
    const parent = await req.payload.findByID({
      collection: 'gl-accounts',
      id: data.parent,
      depth: 0,
      overrideAccess: true,
    })
    data.level = Number((parent as any)?.level ?? 0) + 1
  } else if (data?.level == null) {
    data.level = 0
  }

  return data
}

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
          overrideAccess: true,
        })
        const accounts = acctRes.docs as any[]
        const where: any = {}
        if (tenant) where.tenant = { equals: tenant }
        const sums = await sumPostedByAccount(req.payload, where, true)
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
            // Assets (debit normal)
            { code: '1001', name: 'Cash on Hand', type: 'asset', class: 'cash', group: 'Cash & Cash Equivalents', normalBalance: 'debit' },
            { code: '1002', name: 'Petty Cash', type: 'asset', class: 'cash', group: 'Cash & Cash Equivalents', normalBalance: 'debit' },
            { code: '1101', name: 'Bank Account', type: 'asset', class: 'bank', group: 'Bank Accounts', normalBalance: 'debit' },
            { code: '1201', name: 'Accounts Receivable', type: 'asset', class: 'other', group: 'Accounts Receivable', normalBalance: 'debit' },
            { code: '1301', name: 'Inventory', type: 'asset', class: 'other', group: 'Inventory', normalBalance: 'debit' },
            { code: '1401', name: 'Prepaid Expenses', type: 'asset', class: 'other', group: 'Prepaid Expenses', normalBalance: 'debit' },
            { code: '1501', name: 'Fixed Assets', type: 'asset', class: 'other', group: 'Fixed Asset Cost', normalBalance: 'debit' },
            { code: '1502', name: 'Accumulated Depreciation', type: 'asset', class: 'other', group: 'Accumulated Depreciation', parentCode: '1501', normalBalance: 'credit' },

            // Liabilities (credit normal)
            { code: '2001', name: 'Accounts Payable', type: 'liability', class: 'other', group: 'Accounts Payable', normalBalance: 'credit' },
            { code: '2101', name: 'VAT Payable', type: 'liability', class: 'other', group: 'Tax Liabilities', normalBalance: 'credit' },
            { code: '2201', name: 'Accrued Expenses', type: 'liability', class: 'other', group: 'Accrued Expenses', normalBalance: 'credit' },
            { code: '2301', name: 'Long-term Loan', type: 'liability', class: 'other', group: 'Long-term Liabilities', normalBalance: 'credit' },

            // Equity (credit normal)
            { code: '3001', name: 'Capital', type: 'equity', class: 'other', group: 'Capital', normalBalance: 'credit' },
            { code: '3101', name: 'Retained Earnings', type: 'equity', class: 'other', group: 'Retained Earnings', normalBalance: 'credit' },

            // Income (credit normal)
            { code: '4001', name: 'Sales Revenue', type: 'income', class: 'other', group: 'Sales Revenue', normalBalance: 'credit' },
            { code: '4101', name: 'Service Income', type: 'income', class: 'other', group: 'Service Income', normalBalance: 'credit' },
            { code: '4201', name: 'Other Income', type: 'income', class: 'other', group: 'Other Income', normalBalance: 'credit' },
            { code: '4301', name: 'Membership Fee Income', type: 'income', class: 'other', group: 'Membership Fee Income', normalBalance: 'credit' },
            { code: '4401', name: 'Donation Income', type: 'income', class: 'other', group: 'Donation Income', normalBalance: 'credit' },

            // Expenses (debit normal); Sales Returns is contra (credit normal)
            { code: '5001', name: 'Cost of Goods Sold', type: 'expense', class: 'other', group: 'Cost of Goods Sold', normalBalance: 'debit' },
            { code: '5101', name: 'Salary & Wages', type: 'expense', class: 'other', group: 'Salary & Wages', normalBalance: 'debit' },
            { code: '5201', name: 'Rent', type: 'expense', class: 'other', group: 'Rent', normalBalance: 'debit' },
            { code: '5301', name: 'Utilities', type: 'expense', class: 'other', group: 'Utilities', normalBalance: 'debit' },
            { code: '5401', name: 'Office Supplies', type: 'expense', class: 'other', group: 'Office Supplies', normalBalance: 'debit' },
            { code: '5501', name: 'Depreciation', type: 'expense', class: 'other', group: 'Depreciation', normalBalance: 'debit' },
            { code: '5601', name: 'Other Expenses', type: 'expense', class: 'other', group: 'Other Expenses', normalBalance: 'debit' },
            { code: '5701', name: 'Sales Returns', type: 'expense', class: 'other', group: 'Other Expenses', normalBalance: 'credit' },
          ]

          const createdByCode = new Map<string, any>()
          let created = 0
          let skipped = 0
          for (const acct of defaults) {
            // Unique code within tenant (defense in depth alongside the hook).
            const existing = await req.payload.find({
              collection: 'gl-accounts',
              where: {
                and: [
                  { code: { equals: acct.code } },
                  { tenant: { equals: tenant } },
                ],
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            if (existing.docs.length > 0) {
              skipped++
              continue
            }

            // Resolve group by exact name — never seed an orphan account.
            const groupRes = await req.payload.find({
              collection: 'account-groups',
              where: { name: { equals: acct.group } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            const group = groupRes.docs[0] as any
            if (!group) {
              throw new Error(
                `Account group "${acct.group}" not found — seed account groups first.`,
              )
            }

            // Resolve parent account by code (created earlier in this run).
            let parentId: number | null = null
            if (acct.parentCode) {
              const p = createdByCode.get(acct.parentCode)
              if (p) parentId = Number(p.id)
            }

            const createdAcct = await req.payload.create({
              collection: 'gl-accounts',
              data: {
                code: acct.code,
                name: acct.name,
                type: acct.type,
                class: acct.class,
                group: group.id,
                parent: parentId,
                normalBalance: acct.normalBalance,
                openingBalance: 0,
                active: true,
                tenant,
              } as any,
              overrideAccess: true,
            })
            createdByCode.set(acct.code, createdAcct)
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
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional note or heading/subheading context for this account.',
      },
    },
    {
      name: 'group',
      type: 'relationship',
      relationTo: 'account-groups',
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        description: 'Parent account — creates a sub-account (parent → child) hierarchy.',
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
        description: 'Deprecated — do not use. Single source of truth is the opening-balances collection.',
        position: 'sidebar',
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
    {
      name: 'normalBalance',
      type: 'select',
      defaultValue: 'debit',
      options: [
        { label: 'Debit', value: 'debit' },
        { label: 'Credit', value: 'credit' },
      ],
      admin: {
        description: 'Normal balance direction. Contra accounts (e.g. Accumulated Depreciation) carry a credit normal balance.',
      },
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
    beforeValidate: [assignTenant, validateAccount],
  },
}
