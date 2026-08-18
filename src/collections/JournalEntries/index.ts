import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { JOURNAL_EPSILON, round2, toNum, validateJournalLines } from '@/utilities/journalValidation'
import { sumPostedByAccount } from '@/utilities/journalSums'
import { getBillingSettings } from '@/utilities/billingSettings'
import { assignTenant } from '@/utilities/tenantScope'
import { paginate, parsePagination } from '@/utilities/pagination'

function vErr(message: string): ValidationError {
  return new ValidationError({
    collection: 'journal-entries',
    errors: [{ message, path: 'lines' }],
  })
}

type JournalLine = {
  account?: number | string | { id: number | string } | null
  debit?: number | string | null
  credit?: number | string | null
  memo?: string | null
}

function validateLines(lines: JournalLine[] | null | undefined) {
  const errors = validateJournalLines(lines)
  if (errors.length) {
    throw vErr(errors[0] ?? 'Invalid journal lines.')
  }
}

export const JournalEntries: CollectionConfig = {
  slug: 'journal-entries',
  admin: {
    useAsTitle: 'narration',
    group: 'Billing',
    defaultColumns: ['date', 'narration', 'status', 'postedAt', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      path: '/trial-balance',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        // Illaka users are forced to their own illaka; central may pass any.
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))

        const where: any = {}
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const sums = await sumPostedByAccount(req.payload, where)
        const ids = [...sums.keys()]
        const acctRes = ids.length
          ? await req.payload.find({
              collection: 'gl-accounts',
              where: { id: { in: ids } },
              limit: 1000,
              depth: 0,
            })
          : { docs: [] }
        const acctById = new Map((acctRes.docs as any[]).map((a) => [a.id, a]))

        const rows = ids
          .map((id) => {
            const a = acctById.get(id)
            const { debit, credit } = sums.get(id)!
            return {
              account: {
                id,
                name: a?.name || String(id),
                code: a?.code || '',
                type: a?.type || '',
              },
              debit,
              credit,
              balance: debit - credit,
            }
          })
          .sort((x, y) => {
            const t = (x.account.type || '').localeCompare(y.account.type || '')
            return t !== 0 ? t : x.account.name.localeCompare(y.account.name)
          })

        const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
        const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
        const page = paginate(rows, parsePagination(searchParams))

        return Response.json({
          docs: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
          totals: { debit: totalDebit, credit: totalCredit },
          balanced: Math.abs(totalDebit - totalCredit) <= JOURNAL_EPSILON,
        })
      },
    },
    {
      path: '/ledger',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const account = searchParams.get('account')
        if (!account) {
          return Response.json({ error: 'Missing account parameter' }, { status: 400 })
        }
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))

        const where: any = {
          status: { equals: 'posted' },
          'lines.account': { equals: account },
        }
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const res = await req.payload.find({
          collection: 'journal-entries',
          where,
          limit: 1000,
          depth: 0,
          sort: 'date',
        })

        let running = 0
        const docs = (res.docs as any[]).map((entry) => {
          let debit = 0
          let credit = 0
          for (const line of entry.lines || []) {
            const accId =
              typeof line.account === 'object' && line.account
                ? line.account.id
                : line.account
            if (String(accId) === String(account)) {
              debit += toNum(line.debit)
              credit += toNum(line.credit)
            }
          }
          running += debit - credit
          return {
            id: entry.id,
            date: entry.date,
            narration: entry.narration || '',
            status: entry.status,
            debit,
            credit,
            balance: debit - credit,
            runningBalance: running,
          }
        })

        const page = paginate(docs, parsePagination(searchParams))
        return Response.json({
          docs: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
          closingBalance: running,
        })
      },
    },
    {
      // Profit & Loss: income and expense accounts from posted entries in a
      // date range, with net profit. Derived entirely from the journal.
      path: '/profit-loss',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const where: any = {}
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const sums = await sumPostedByAccount(req.payload, where)
        const ids = [...sums.keys()]
        const acctRes = ids.length
          ? await req.payload.find({
              collection: 'gl-accounts',
              where: { id: { in: ids } },
              limit: 1000,
              depth: 0,
            })
          : { docs: [] }
        const acctById = new Map((acctRes.docs as any[]).map((a) => [a.id, a]))

        const income: any[] = []
        const expense: any[] = []
        for (const [id, s] of sums) {
          const a = acctById.get(id)
          if (!a) continue
          if (a.type === 'income') {
            income.push({
              account: { id, code: a.code, name: a.name },
              amount: round2(s.credit - s.debit),
            })
          } else if (a.type === 'expense') {
            expense.push({
              account: { id, code: a.code, name: a.name },
              amount: round2(s.debit - s.credit),
            })
          }
        }
        const byName = (x: any, y: any) =>
          x.account.name.localeCompare(y.account.name)
        income.sort(byName)
        expense.sort(byName)
        const totalIncome = round2(income.reduce((t, r) => t + r.amount, 0))
        const totalExpense = round2(expense.reduce((t, r) => t + r.amount, 0))
        const p = parsePagination(searchParams)
        const incomePage = paginate(income, p)
        const expensePage = paginate(expense, p)
        return Response.json({
          income: incomePage.docs,
          expense: expensePage.docs,
          incomeTotal: incomePage.total,
          expenseTotal: expensePage.total,
          limit: p.limit,
          offset: p.offset,
          totals: {
            income: totalIncome,
            expense: totalExpense,
            netProfit: round2(totalIncome - totalExpense),
          },
        })
      },
    },
    {
      // Balance sheet: asset / liability / equity balances from posted entries,
      // with current-period retained earnings (income − expense) folded into
      // equity so Assets = Liabilities + Equity holds.
      path: '/balance-sheet',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const where: any = {}
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const sums = await sumPostedByAccount(req.payload, where)
        const ids = [...sums.keys()]
        const acctRes = ids.length
          ? await req.payload.find({
              collection: 'gl-accounts',
              where: { id: { in: ids } },
              limit: 1000,
              depth: 0,
            })
          : { docs: [] }
        const acctById = new Map((acctRes.docs as any[]).map((a) => [a.id, a]))

        const assets: any[] = []
        const liabilities: any[] = []
        const equity: any[] = []
        let incomeTotal = 0
        let expenseTotal = 0
        for (const [id, s] of sums) {
          const a = acctById.get(id)
          if (!a) continue
          const item = { account: { id, code: a.code, name: a.name } }
          if (a.type === 'asset') {
            assets.push({ ...item, balance: round2(s.debit - s.credit) })
          } else if (a.type === 'liability') {
            liabilities.push({ ...item, balance: round2(s.credit - s.debit) })
          } else if (a.type === 'equity') {
            equity.push({ ...item, balance: round2(s.credit - s.debit) })
          } else if (a.type === 'income') {
            incomeTotal += s.credit - s.debit
          } else if (a.type === 'expense') {
            expenseTotal += s.debit - s.credit
          }
        }
        const netProfit = round2(incomeTotal - expenseTotal)
        equity.push({
          account: { id: null, code: '', name: 'Retained earnings (current period)' },
          balance: netProfit,
        })

        const byName = (x: any, y: any) =>
          x.account.name.localeCompare(y.account.name)
        assets.sort(byName)
        liabilities.sort(byName)
        equity.sort(byName)
        const totalAssets = round2(assets.reduce((t, r) => t + r.balance, 0))
        const totalLiabilities = round2(
          liabilities.reduce((t, r) => t + r.balance, 0),
        )
        const totalEquity = round2(equity.reduce((t, r) => t + r.balance, 0))
        const p = parsePagination(searchParams)
        const assetsPage = paginate(assets, p)
        const liabilitiesPage = paginate(liabilities, p)
        const equityPage = paginate(equity, p)
        return Response.json({
          assets: assetsPage.docs,
          liabilities: liabilitiesPage.docs,
          equity: equityPage.docs,
          assetsTotal: assetsPage.total,
          liabilitiesTotal: liabilitiesPage.total,
          equityTotal: equityPage.total,
          limit: p.limit,
          offset: p.offset,
          totals: {
            assets: totalAssets,
            liabilities: totalLiabilities,
            equity: totalEquity,
            liabilitiesEquity: round2(totalLiabilities + totalEquity),
          },
          balanced:
            Math.abs(totalAssets - (totalLiabilities + totalEquity)) <=
            JOURNAL_EPSILON,
        })
      },
    },
    {
      // Daybooks: the five primary registers as filters over the posted
      // journal. Cash & bank book (accounts class cash/bank), petty cash
      // (the petty cash account from settings), sales (income accounts),
      // purchase (expense accounts), journal proper (entries not produced
      // by a voucher). Cash books carry a running balance.
      path: '/daybook',
      method: 'get',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { searchParams } = new URL(req.url || '/')
        const type = searchParams.get('type') || 'cash'
        if (
          !['cash', 'petty-cash', 'sales', 'purchase', 'journal'].includes(
            type,
          )
        ) {
          return Response.json(
            { error: 'type must be cash | petty-cash | sales | purchase | journal' },
            { status: 400 },
          )
        }
        const from = searchParams.get('from') || undefined
        const to = searchParams.get('to') || undefined
        const tenant = resolveScopedTenant(req, searchParams.get('tenant'))
        const where: any = {}
        if (from) where.date = { ...((where.date as object) || {}), greater_than_equal: from }
        if (to) where.date = { ...((where.date as object) || {}), less_than_equal: to }
        if (tenant) where.tenant = { equals: tenant }

        const entries = await req.payload.find({
          collection: 'journal-entries',
          where: { status: { equals: 'posted' }, ...where },
          limit: 1000,
          depth: 0,
          sort: 'date',
        })
        const acctRes = await req.payload.find({
          collection: 'gl-accounts',
          limit: 1000,
          depth: 0,
        })
        const acctById = new Map(
          (acctRes.docs as any[]).map((a) => [a.id, a]),
        )
        const settings = await getBillingSettings(req.payload)
        const pettyId = settings?.pettyCashAccount
          ? Number(settings.pettyCashAccount)
          : null

        const rows: any[] = []
        for (const entry of entries.docs as any[]) {
          if (type === 'journal' && entry.referenceDoc) continue
          for (const line of entry.lines || []) {
            const accId =
              typeof line.account === 'object' && line.account
                ? line.account.id
                : line.account
            if (accId === undefined || accId === null) continue
            const a = acctById.get(Number(accId))
            if (!a) continue
            let match = false
            if (type === 'cash') {
              match = a.class === 'cash' || a.class === 'bank'
            } else if (type === 'petty-cash') {
              match = pettyId !== null && Number(accId) === pettyId
            } else if (type === 'sales') {
              match = a.type === 'income'
            } else if (type === 'purchase') {
              match = a.type === 'expense'
            } else {
              match = true
            }
            if (!match) continue
            rows.push({
              id: entry.id,
              date: entry.date,
              narration: entry.narration || '',
              accountName: a.name,
              debit: round2(toNum(line.debit)),
              credit: round2(toNum(line.credit)),
            })
          }
        }

        let running = 0
        for (const r of rows) {
          if (type === 'cash' || type === 'petty-cash') {
            running = round2(running + r.debit - r.credit)
            r.runningBalance = running
          }
        }
        const totalDebit = round2(rows.reduce((t, r) => t + r.debit, 0))
        const totalCredit = round2(rows.reduce((t, r) => t + r.credit, 0))
        const page = paginate(rows, parsePagination(searchParams))
        return Response.json({
          type,
          rows: page.docs,
          total: page.total,
          hasMore: page.hasMore,
          limit: parsePagination(searchParams).limit,
          offset: parsePagination(searchParams).offset,
          totals: { debit: totalDebit, credit: totalCredit },
          closingBalance: running,
        })
      },
    },
  ],
  hooks: {
    beforeValidate: [
      assignTenant,
      ({ data, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data
        const lines = (data as any)?.lines as JournalLine[] | null | undefined
        validateLines(lines)
        return data
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        const doc = originalDoc as any
        // Posted entries are immutable except for voiding; void entries are final.
        // Note: on updates Payload merges the original doc into `data` before
        // collection hooks run, so an edit that doesn't change `status` still
        // arrives here with `data.status === 'posted'` — the strict check below
        // is what actually catches partial edits of posted entries.
        // (Bank reconciliation marks `cleared` with a raw SQL UPDATE that
        // bypasses this hook — see the bank-statements reconcile endpoint.)
        if (operation === 'update' && (doc?.status === 'posted' || doc?.status === 'void')) {
          const nextStatus = (data as any)?.status
          const allowed = doc.status === 'posted' ? nextStatus === 'void' : false
          if (!allowed) {
            throw vErr(
              doc.status === 'posted'
                ? 'Posted entries cannot be edited. Void the entry to reverse it.'
                : 'Void entries are final and cannot be modified.',
            )
          }
        }
        // Stamp postedAt when an entry is posted (create or transition).
        if ((data as any)?.status === 'posted') {
          if (operation === 'create' || doc?.status !== 'posted') {
            ;(data as any).postedAt = new Date().toISOString()
          }
        }
        return data
      },
      // Period freeze: no posted entry may carry a date before the freeze
      // date. Runs on every create/update (the engine's postings go through
      // the same hook, so vouchers are covered too).
      async ({ data, req }) => {
        const d = data as any
        if (d?.status !== 'posted' || !d?.date) return data
        const settings = await getBillingSettings(req.payload)
        const freeze = settings?.freezeDate
        if (freeze && new Date(d.date) < new Date(freeze)) {
          throw vErr(
            `Entries cannot be posted before the freeze date (${String(freeze).slice(0, 10)}).`,
          )
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'narration',
      type: 'textarea',
      admin: {
        description: 'Description of the entry (e.g. "Rent for March", "Member donation").',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Posted', value: 'posted' },
        { label: 'Void', value: 'void' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'postedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'cleared',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'Marked by bank reconciliation when a matching bank-statement row is found.',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'clearedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Line',
        plural: 'Lines',
      },
      fields: [
        {
          name: 'account',
          type: 'relationship',
          relationTo: 'gl-accounts',
          required: true,
        },
        {
          name: 'debit',
          type: 'number',
          admin: {
            description: 'Amount on the debit side (leave empty if this is a credit line).',
          },
        },
        {
          name: 'credit',
          type: 'number',
          admin: {
            description: 'Amount on the credit side (leave empty if this is a debit line).',
          },
        },
        {
          name: 'memo',
          type: 'text',
        },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    // Link back to the source document that produced this entry (vouchers).
    {
      name: 'referenceDoc',
      type: 'relationship',
      relationTo: 'documents',
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
