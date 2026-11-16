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
import { validateAccountData } from '@/utilities/accountingValidation'
import { sumPostedByAccount } from '@/utilities/journalSums'
import { round2, toNum } from '@/utilities/journalValidation'
import { paginate, parsePagination } from '@/utilities/pagination'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

/** Validate account data: no self-parent, no parent cycle, unique code within
 * tenant.
 *
 * Cycles are walked up the parent chain and bounded at 50 hops. Codes must be
 * unique per tenant (excluding the account being edited).
 *
 * Field-level rules (blank name, duplicate code, invalid type, incompatible
 * child type, parent-company mismatch, deletion restrictions) are delegated
 * to the centralized accountingValidation service.
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

  // Gather context for field-level validation.
  let existingCodes: string[] = []
  let parentType: string | undefined
  let parentTenant: number | undefined

  if (req?.payload) {
    // Existing codes in this tenant (excluding the account being edited).
    const codeRes = await req.payload.find({
      collection: 'gl-accounts',
      where: {
        and: [
          { tenant: { equals: tenant } },
          ...(id ? [{ id: { not_equals: id } }] : []),
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    existingCodes = (codeRes.docs as any[]).map((d) => String(d.code))

    // Resolve parent type + tenant for compatibility checks.
    if (data?.parent) {
      const parent = await req.payload.findByID({
        collection: 'gl-accounts',
        id: data.parent,
        depth: 0,
        overrideAccess: true,
      })
      if (parent) {
        parentType = (parent as any).type
        parentTenant = (parent as any).tenant
      }
    }
  }

  // Field-level validation via the centralized service.
  const fieldResult = validateAccountData({
    data,
    existingCodes,
    parentId: data?.parent ?? null,
    parentType,
    parentTenant,
    tenant,
  })
  if (!fieldResult.valid) {
    throw new Error(fieldResult.issues.map((i) => i.message).join(' '))
  }

  // An account cannot be its own parent.
  if (data?.parent != null && id != null && data.parent === id) {
    throw new Error('An account cannot be its own parent.')
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
    // ── GET /api/gl-accounts/tree ────────────────────────────────────
    // Hierarchical account tree (root → children → grandchildren), tenant-scoped.
    {
      path: '/tree',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const res = await req.payload.find({
          collection: 'gl-accounts',
          where: tenant ? { tenant: { equals: tenant } } : undefined,
          limit: 2000,
          depth: 0,
          overrideAccess: true,
          sort: 'code',
        })
        const accounts = (res.docs as any[]).map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          level: a.level,
          parent: typeof a.parent === 'object' && a.parent ? a.parent.id : a.parent,
          status: a.status,
          active: a.active,
        })) as any[]
        const byId = new Map(accounts.map((a) => [a.id, a]))
        const roots: any[] = []
        for (const a of accounts) {
          a.children = []
          if (!a.parent || !byId.has(a.parent)) {
            roots.push(a)
          } else {
            byId.get(a.parent)!.children.push(a)
          }
        }
        return Response.json({ docs: roots, total: roots.length })
      },
    },
    // ── GET /api/gl-accounts/:id/children ────────────────────────────
    // Direct children of an account.
    {
      path: '/:id/children',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const res = await req.payload.find({
          collection: 'gl-accounts',
          where: {
            and: [
              { parent: { equals: (req as any).params.id } },
              ...(tenant ? [{ tenant: { equals: tenant } }] : []),
            ],
          },
          limit: 2000,
          depth: 0,
          overrideAccess: true,
          sort: 'code',
        })
        return Response.json({
          docs: res.docs,
          total: res.totalDocs,
          hasMore: res.hasNextPage,
        })
      },
    },
    // ── GET /api/gl-accounts/:id/ledger ──────────────────────────────
    // Ledger activity for an account — delegates to journal-entries /ledger.
    {
      path: '/:id/ledger',
      method: 'get',
      handler: async (req) => {
        const acctId = (req as any).params.id
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        searchParams.set('account', acctId)
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        if (tenant) searchParams.set('tenant', String(tenant))
        const ledgerRes = await req.payload.find({
          collection: 'journal-entries',
          where: {
            status: { equals: 'posted' },
            'lines.account': { equals: acctId },
            ...(tenant ? { tenant: { equals: tenant } } : {}),
          },
          limit: 1000,
          depth: 0,
          sort: 'date',
          overrideAccess: true,
        })
        let running = 0
        const docs = (ledgerRes.docs as any[]).map((entry) => {
          let debit = 0
          let credit = 0
          for (const line of entry.lines || []) {
            const accId =
              typeof line.account === 'object' && line.account
                ? line.account.id
                : line.account
            if (String(accId) === String(acctId)) {
              debit += toNum(line.debit)
              credit += toNum(line.credit)
            }
          }
          running += debit - credit
          return {
            id: entry.id,
            date: entry.date,
            narration: entry.narration,
            debit: round2(debit),
            credit: round2(credit),
            running: round2(running),
          }
        })
        return Response.json({ docs, total: ledgerRes.totalDocs })
      },
    },
    // ── POST /api/gl-accounts/import ─────────────────────────────────
    // Import accounts from CSV text, base64 xlsx, or rows array.
    // Codes unique per tenant; validated via accountingValidation (backend-authoritative).
    {
      path: '/import',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json?.()) as any
          const tenant = resolveScopedTenant(req, body.tenant)
          if (!tenant) {
            return Response.json({ error: 'tenant is required.' }, { status: 400 })
          }

          let rows: any[]
          if (typeof body.csv === 'string' && body.csv.trim()) {
            const parsed = parse(body.csv, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, unknown>[]
            rows = parsed.map((r) => ({
              code: r.code ?? r['Account Code'] ?? r['account_code'],
              name: r.name ?? r['Account Name'] ?? r['account_name'],
              type: r.type ?? r['Account Type'] ?? r['account_type'],
              parentCode: r.parentCode ?? r['Parent Code'] ?? r['parent_code'],
              group: r.group ?? r['Account Group'] ?? r['account_group'],
              normalBalance: r.normalBalance ?? r['Normal Balance'] ?? r['normal_balance'],
              financialStatement: r.financialStatement ?? r['Financial Statement'] ?? r['financial_statement'],
              postingAllowed: r.postingAllowed ?? r['Posting Allowed'] ?? r['posting_allowed'],
              controlAccount: r.controlAccount ?? r['Control Account'] ?? r['control_account'],
              currencyCode: r.currencyCode ?? r['Currency Code'] ?? r['currency_code'],
              status: r.status ?? r['Status'] ?? r['status'],
              effectiveFrom: r.effectiveFrom ?? r['Effective From'] ?? r['effective_from'],
              description: r.description ?? r['Description'] ?? r['description'],
            }))
          } else if (typeof body.file === 'string' && body.file.trim()) {
            const buf = Buffer.from(body.file, 'base64')
            const workbook = XLSX.read(buf, { type: 'buffer' })
            const sheetName = workbook.SheetNames[0]
            if (!sheetName) {
              return Response.json({ error: 'xlsx file has no sheets.' }, { status: 400 })
            }
            const sheet = workbook.Sheets[sheetName] as any
            const parsed = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]
            const headers = parsed[0] as string[]
            rows = parsed.slice(1).map((r: any[]) => {
              const row: Record<string, unknown> = {}
              headers.forEach((h, i) => { row[String(h).trim()] = r[i] })
              return {
                code: row.code ?? row['Account Code'] ?? row['account_code'],
                name: row.name ?? row['Account Name'] ?? row['account_name'],
                type: row.type ?? row['Account Type'] ?? row['account_type'],
                parentCode: row.parentCode ?? row['Parent Code'] ?? row['parent_code'],
                group: row.group ?? row['Account Group'] ?? row['account_group'],
                normalBalance: row.normalBalance ?? row['Normal Balance'] ?? row['normal_balance'],
                financialStatement: row.financialStatement ?? row['Financial Statement'] ?? row['financial_statement'],
                postingAllowed: row.postingAllowed ?? row['Posting Allowed'] ?? row['posting_allowed'],
                controlAccount: row.controlAccount ?? row['Control Account'] ?? row['control_account'],
                currencyCode: row.currencyCode ?? row['Currency Code'] ?? row['currency_code'],
                status: row.status ?? row['Status'] ?? row['status'],
                effectiveFrom: row.effectiveFrom ?? row['Effective From'] ?? row['effective_from'],
                description: row.description ?? row['Description'] ?? row['description'],
              }
            })
          } else if (Array.isArray(body.rows)) {
            rows = body.rows
          } else {
            return Response.json({ error: 'Provide \"csv\", \"file\" (base64 xlsx), or \"rows\" array.' }, { status: 400 })
          }

          if (!rows.length) {
            return Response.json({ error: 'No rows to import.' }, { status: 400 })
          }

          const existingRes = await req.payload.find({
            collection: 'gl-accounts',
            where: { tenant: { equals: tenant } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })
          const existingCodes = new Set((existingRes.docs as any[]).map((d) => String(d.code)))
          const createdByCode = new Map<string, any>()
          const created: any[] = []
          const skipped: any[] = []
          const errors: any[] = []

          for (let i = 0; i < rows.length; i++) {
            const r = rows[i]
            const ref = `row ${i + 1}`
            const code = String(r.code ?? '').trim()
            if (!code) { errors.push({ row: ref, error: 'code is required' }); continue }

            const name = String(r.name ?? '').trim()
            if (!name) { errors.push({ row: ref, code, error: 'name is required' }); continue }

            const data: any = {
              code,
              name,
              type: r.type,
              normalBalance: r.normalBalance,
              financialStatement: r.financialStatement,
              postingAllowed: r.postingAllowed === 'true' || r.postingAllowed === true || r.postingAllowed === 1 || r.postingAllowed === '1',
              controlAccount: r.controlAccount === 'true' || r.controlAccount === true || r.controlAccount === 1 || r.controlAccount === '1',
              currencyCode: String(r.currencyCode ?? 'NPR').trim(),
              status: r.status ?? 'active',
              effectiveFrom: r.effectiveFrom ?? undefined,
              description: r.description ?? undefined,
              tenant,
            }

            let parentId: number | null = null
            if (r.parentCode) {
              const p = createdByCode.get(String(r.parentCode).trim())
              if (p) parentId = Number(p.id)
            }
            if (parentId != null) data.parent = parentId

            const result = validateAccountData({
              data,
              existingCodes: Array.from(existingCodes),
              parentId,
              parentType: undefined,
              parentTenant: undefined,
              tenant: tenant as unknown as number,
            })
            if (!result.valid) {
              errors.push({ row: ref, code, issues: result.issues })
              continue
            }

            // Resolve group by name if provided (never seed an orphan account).
            if (r.group) {
              const groupRes = await req.payload.find({
                collection: 'account-groups',
                where: { name: { equals: String(r.group).trim() } },
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              const group = groupRes.docs[0] as any
              if (group) data.group = group.id
            }

            try {
              const acct = await req.payload.create({
                collection: 'gl-accounts',
                data,
                overrideAccess: true,
              } as any)
              existingCodes.add(code)
              createdByCode.set(code, acct)
              created.push({ row: ref, id: acct.id, code: (acct as any).code })
            } catch (e: any) {
              errors.push({ row: ref, code, error: e?.message || 'create failed' })
            }
          }

          return Response.json({ created: created.length, skipped: skipped.length, errorCount: errors.length, items: created, errors })
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 400 })
        }
      },
    },
    // ── GET /api/gl-accounts/export ──────────────────────────────────
    // Export all accounts for a tenant as CSV.
    {
      path: '/export',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const { searchParams } = new URL(req.url || '/')
          const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
          if (!tenant) {
            return Response.json({ error: 'tenant is required.' }, { status: 400 })
          }
          const res = await req.payload.find({
            collection: 'gl-accounts',
            where: { tenant: { equals: tenant } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })
          const accounts = res.docs as any[]
          const rows = accounts.map((a) => ({
            code: a.code,
            name: a.name,
            type: a.type,
            parentCode: typeof a.parent === 'object' && a.parent ? a.parent.code : undefined,
            group: typeof a.group === 'object' && a.group ? a.group.name : undefined,
            normalBalance: a.normalBalance,
            financialStatement: a.financialStatement,
            postingAllowed: a.postingAllowed,
            controlAccount: a.controlAccount,
            currencyCode: a.currencyCode,
            status: a.status,
            effectiveFrom: a.effectiveFrom,
            description: a.description,
          }))
          const headers = Object.keys(rows[0] ?? {})
          const esc = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
          const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(String((r as any)[h] ?? ''))).join(',')).join(String.fromCharCode(10))]
          return new Response(csv.join('\n'), {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="chart-of-accounts-${tenant}.csv"`,
            },
          })
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 400 })
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
    // ── COA Phase 1: spec §5 account-master fields (additive) ─────────
    // company <-> tenant mapping: spec company_id == existing tenant.
    // Audit reuses existing audit-logs (entityType='account') — no dup table.
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Blocked', value: 'blocked' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description:
          'Active = new transactions allowed. Inactive/Blocked/Archived = no new postings; history remains readable.',
      },
    },
    {
      name: 'financialStatement',
      type: 'select',
      options: [
        { label: 'Balance Sheet', value: 'balance-sheet' },
        { label: 'Income Statement', value: 'income-statement' },
      ],
      admin: {
        description:
          'System-derived from account type where possible; editable override.',
        position: 'sidebar',
      },
    },
    {
      name: 'postingAllowed',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Whether direct journal postings are allowed. Non-posting accounts are headings/control accounts.',
        position: 'sidebar',
      },
    },
    {
      name: 'controlAccount',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Control (subledger) account — must reconcile with supporting party balances.',
        position: 'sidebar',
      },
    },
    {
      name: 'reconciliationRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Periodic reconciliation required for this account.',
        position: 'sidebar',
      },
    },
    {
      name: 'costCentreRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Cost centre dimension required on postings to this account.',
        position: 'sidebar',
      },
    },
    {
      name: 'branchRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Branch dimension required on postings to this account.',
        position: 'sidebar',
      },
    },
    {
      name: 'currencyCode',
      type: 'text',
      defaultValue: 'NPR',
      admin: {
        description: 'Account currency code (ISO). Defaults to NPR.',
        position: 'sidebar',
      },
    },
    {
      name: 'effectiveFrom',
      type: 'date',
      admin: {
        description: 'Date from which this account definition is effective.',
        position: 'sidebar',
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      admin: {
        description: 'Soft-delete timestamp. Set instead of hard delete when children or ledger activity exist.',
        position: 'sidebar',
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
