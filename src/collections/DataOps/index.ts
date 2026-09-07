import {
  isBillingUser,
  isCentralUser,
  isIllakaUser,
  resolveScopedTenant,
} from '@/access/tenantScoped'
import type { CollectionConfig, Payload, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import { getBillingSettings } from '@/utilities/billingSettings'
import { round2, toNum } from '@/utilities/journalValidation'

/**
 * Hidden admin collection that owns the destructive / bootstrap data actions.
 *
 * POST /api/data-ops/cleanup   — wipe one tenant's transaction-level data
 *                                (documents, journal entries, stock movements,
 *                                bank statements, expense claims, recurring
 *                                schedules, opening balances, fixed assets)
 *                                while keeping masters (ilakas/tenants,
 *                                accounts, goods, people, tax types, years).
 * POST /api/data-ops/seed-demo — bootstrap demo data for a tenant: a starter
 *                                chart of accounts + default mappings, VAT,
 *                                a few parties & items, and draft vouchers
 *                                that land in the Posting queue. Only runs
 *                                while billing-settings.demoSeedEnabled.
 *
 * Both are server-synchronous (never queued to the client outbox), scoped to
 * exactly one tenant, and recorded in the audit log with the counts.
 */

const WIPE_COLLECTIONS = [
  'documents',
  'journal-entries',
  'stock-movements',
  'bank-statements',
  'expense-claims',
  'recurring-schedules',
  'opening-balances',
  'fixed-assets',
] as const

/** Destructive actions need a real operator — viewers and plain users are out. */
function canRunDataOps(user: User | null | undefined): boolean {
  return Boolean(user && (isCentralUser(user) || isIllakaUser(user)))
}

function partyCount(parties: { customer?: number; both?: number; vendor?: number }): number {
  return [parties.customer, parties.both, parties.vendor].filter(Boolean).length
}

function roleOf(user: User | null | undefined): string {
  return (user?.role as string) || ''
}

function userNameOf(user: User | null | undefined): string {
  const u = user as any
  return u?.email || u?.name || ''
}

/** Resolve the explicit ?tenant/bodies tenant for a request, or the user's. */
function targetTenant(req: PayloadRequest, explicit?: string | null): string | null {
  if (!canRunDataOps(req.user)) return null
  const t = resolveScopedTenant(req, explicit || null)
  return t ? String(t) : null
}

async function wipeCollection(
  payload: Payload,
  slug: string,
  tenant: string,
): Promise<{ deleted: number; errors: number }> {
  try {
    const res = await payload.delete({
      collection: slug as any,
      where: { tenant: { equals: tenant } },
      overrideAccess: true,
    })
    return { deleted: (res.docs || []).length, errors: (res.errors || []).length }
  } catch {
    return { deleted: 0, errors: 0 }
  }
}

/** Reset voucher counters whose key ends with `:<tenant>`. */
async function resetSequences(payload: Payload, tenant: string): Promise<number> {
  let reset = 0
  try {
    const res = await payload.find({
      collection: 'doc-sequences',
      limit: 1000,
      depth: 0,
    })
    for (const seq of (res.docs as any[]) || []) {
      if (!String(seq?.key).endsWith(`:${tenant}`)) continue
      await payload.update({
        collection: 'doc-sequences',
        id: seq.id,
        data: { lastNumber: 0 },
        overrideAccess: true,
      })
      reset++
    }
  } catch {
    /* sequences may not exist yet — nothing to reset */
  }
  return reset
}

async function bumpEpoch(payload: Payload): Promise<number> {
  const settings = await getBillingSettings(payload)
  const next = toNum(settings?.dataEpoch) + 1
  await payload.updateGlobal({
    slug: 'billing-settings',
    data: { dataEpoch: next },
    overrideAccess: true,
  })
  return next
}

async function writeAudit(
  payload: Payload,
  req: PayloadRequest,
  tenant: string,
  actionLabel: string,
  meta: Record<string, unknown>,
  epoch: number,
): Promise<void> {
  try {
    await payload.create({
      collection: 'audit-logs',
      data: {
        action: 'delete',
        entityType: 'data-ops',
        entityId: actionLabel,
        entityLabel: actionLabel,
        tenant: toNum(tenant),
        userName: userNameOf(req.user),
        userRole: roleOf(req.user),
        meta: { ...meta, epoch },
      },
      overrideAccess: true,
    })
  } catch {
    /* audit must never fail the operation */
  }
}

async function readBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const b = (await req.json?.()) as Record<string, unknown> | undefined
    return b || {}
  } catch {
    return {}
  }
}

// ── Seed templates ────────────────────────────────────────────────

const STARTER_GROUPS = [
  { code: '1', name: 'Current Assets', type: 'asset' },
  { code: '2', name: 'Fixed Assets', type: 'asset' },
  { code: '3', name: 'Current Liabilities', type: 'liability' },
  { code: '4', name: 'Equity', type: 'equity' },
  { code: '5', name: 'Revenue', type: 'income' },
  { code: '6', name: 'Expenses', type: 'expense' },
] as const

const STARTER_ACCOUNTS = [
  { code: '1010', name: 'Cash in Hand', group: '1', type: 'asset', class: 'cash' },
  { code: '1030', name: 'Bank Account', group: '1', type: 'asset', class: 'bank' },
  { code: '1100', name: 'Accounts Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '1200', name: 'Inventory', group: '1', type: 'asset', class: 'other' },
  { code: '1060', name: 'Prepaid Expenses', group: '1', type: 'asset', class: 'other' },
  { code: '1500', name: 'Fixed Asset Cost', group: '2', type: 'asset', class: 'other' },
  { code: '2000', name: 'Accumulated Depreciation', group: '2', type: 'asset', class: 'other' },
  { code: '3000', name: 'Accounts Payable', group: '3', type: 'liability', class: 'other' },
  { code: '3100', name: 'Tax Payable', group: '3', type: 'liability', class: 'other' },
  { code: '3500', name: 'Accrued Liabilities', group: '3', type: 'liability', class: 'other' },
  { code: '4000', name: 'Retained Earnings', group: '4', type: 'equity', class: 'other' },
  { code: '5000', name: 'Revenue', group: '5', type: 'income', class: 'other' },
  { code: '5100', name: 'Membership Fees', group: '5', type: 'income', class: 'other' },
  { code: '5200', name: 'Donations', group: '5', type: 'income', class: 'other' },
  { code: '6000', name: 'Cost of Goods Sold', group: '6', type: 'expense', class: 'other' },
  { code: '6100', name: 'Operating Expenses', group: '6', type: 'expense', class: 'other' },
  { code: '6200', name: 'Depreciation Expense', group: '6', type: 'expense', class: 'other' },
  { code: '6300', name: 'Rent Expense', group: '6', type: 'expense', class: 'other' },
] as const

const SEED_PARTIES = [
  { type: 'customer', name: 'Hari Bahadur Shrestha', phone: '9800000001', address: 'Kathmandu', openingBalance: 0 },
  { type: 'both', name: 'Sita Shrestha & Sons', phone: '9800000002', address: 'Baneshwor', openingBalance: 0 },
  { type: 'vendor', name: 'Nepal Krishi Supplies', phone: '9800000003', address: 'Patan', openingBalance: 0 },
  { type: 'customer', name: 'Kathmandu Mart', phone: '9800000004', address: 'New Road', openingBalance: 0 },
] as const

const SEED_ITEMS = [
  { code: 'RICE', name: 'Rice', unit: 'kg', salePrice: 65, purchasePrice: 58, openingStock: 0 },
  { code: 'OIL', name: 'Cooking Oil', unit: 'ltr', salePrice: 290, purchasePrice: 255, openingStock: 0 },
  { code: 'DAL', name: 'Lentils', unit: 'kg', salePrice: 175, purchasePrice: 160, openingStock: 0 },
  { code: 'TEA', name: 'Tea', unit: 'pkt', salePrice: 380, purchasePrice: 340, openingStock: 0 },
] as const

const SEED_MEMBERSHIP_TYPES = [
  { name: 'साधारण (General)', fee: 500, periodMonths: 12, description: 'Annual general membership', active: true },
  { name: 'स्थायी (Permanent)', fee: 2000, periodMonths: 60, description: 'Permanent (5-year) membership', active: true },
  { name: 'आजीवन (Lifetime)', fee: 5000, periodMonths: 0, description: 'Lifetime membership — one-time fee', active: true },
] as const

const SEED_MEMBERS = [
  { fullName: 'Ram Bahadur Shrestha', email: 'ram.bahadur@example.com', phoneNumber: '9800000101', status: 'active', typeIdx: 0 },
  { fullName: 'Sita Shrestha', email: 'sita.shrestha@example.com', phoneNumber: '9800000102', status: 'active', typeIdx: 1 },
  { fullName: 'Krishna Maharjan', email: 'krishna.maharjan@example.com', phoneNumber: '9800000103', status: 'active', typeIdx: 2 },
] as const

async function ensureTaxType(payload: Payload, tenant: string): Promise<number | null> {
  const tid = toNum(tenant)
  try {
    const existing = await payload.find({
      collection: 'tax-types',
      where: { code: { equals: 'VAT' }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]?.id) return existing.docs[0].id as number
    const created = await payload.create({
      collection: 'tax-types',
      data: { code: 'VAT', name: 'VAT', nature: 'additive', rate: 13, active: true, tenant: tid },
      overrideAccess: true,
    })
    return created.id as number
  } catch {
    // Code uniqueness may already be taken by another tenant — skip tax seeding.
    return null
  }
}

async function ensureChart(payload: Payload, tenant: string): Promise<{ groups: number; accounts: number }> {
  const tid = toNum(tenant)
  try {
    const count = await payload.find({
      collection: 'gl-accounts',
      where: { tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if ((count.totalDocs ?? 0) > 0) return { groups: 0, accounts: 0 }

    const groupIds: Record<string, number> = {}
    for (const g of STARTER_GROUPS) {
      const created = await payload.create({
        collection: 'account-groups',
        data: { ...g, tenant: tid },
        overrideAccess: true,
      })
      groupIds[g.code] = created.id as number
    }
    for (const a of STARTER_ACCOUNTS) {
      await payload.create({
        collection: 'gl-accounts',
        data: { ...a, group: groupIds[a.group], tenant: tid },
        overrideAccess: true,
      })
    }
    return { groups: STARTER_GROUPS.length, accounts: STARTER_ACCOUNTS.length }
  } catch {
    return { groups: 0, accounts: 0 }
  }
}

/** Fill only the default-account slots that are still unset (never clobber). */
async function ensureDefaults(payload: Payload): Promise<string[]> {
  const settings = await getBillingSettings(payload)
  const mapping: Record<string, string> = {
    receivableAccount: '1100',
    payableAccount: '3000',
    cashAccount: '1010',
    bankAccount: '1030',
    taxAccount: '3100',
    inventoryAccount: '1200',
    revenueAccount: '5000',
    expenseAccount: '6100',
    cogsAccount: '6000',
    returnsAccount: '3000',
    membershipFeeAccount: '5100',
    donationAccount: '5200',
    depreciationAccount: '6200',
    accumulatedDepreciationAccount: '2000',
  }
  const patch: Record<string, number> = {}
  for (const [field, code] of Object.entries(mapping)) {
    if (settings?.[field] != null) continue
    try {
      const acc = await payload.find({
        collection: 'gl-accounts',
        where: { code: { equals: code } },
        limit: 1,
        depth: 0,
      })
      const id = acc.docs[0]?.id
      if (id != null) patch[field] = id as number
    } catch {
      /* keep going */
    }
  }
  const fields = Object.keys(patch)
  if (fields.length > 0) {
    try {
      await payload.updateGlobal({ slug: 'billing-settings', data: patch, overrideAccess: true })
    } catch {
      /* best-effort */
    }
  }
  return fields
}

/** Seed the org-wide membership types (idempotent — skips existing by name). */
async function ensureMembershipTypes(payload: Payload): Promise<number[]> {
  const ids: number[] = []
  try {
    for (const t of SEED_MEMBERSHIP_TYPES) {
      const existing = await payload.find({
        collection: 'membership-types',
        where: { name: { equals: t.name } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs[0]?.id) {
        ids.push(existing.docs[0].id as number)
        continue
      }
      const created = await payload.create({
        collection: 'membership-types',
        data: { ...t },
        overrideAccess: true,
      })
      ids.push(created.id as number)
    }
  } catch {
    /* best-effort */
  }
  return ids
}

/** Seed a few sample members against the seeded membership types (idempotent). */
async function ensureMembers(payload: Payload, tenant: string): Promise<number> {
  const tid = toNum(tenant)
  let created = 0
  const typeIds = await ensureMembershipTypes(payload)
  if (typeIds.length === 0) return 0
  try {
    for (const m of SEED_MEMBERS) {
      const existing = await payload.find({
        collection: 'members',
        where: { email: { equals: m.email } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs[0]?.id) continue
      const typeId = typeIds[m.typeIdx] ?? typeIds[0]
      await payload.create({
        collection: 'members',
        data: {
          fullName: m.fullName,
          email: m.email,
          phoneNumber: m.phoneNumber,
          status: m.status,
          membershipType: typeId,
          tenant: tid,
        },
        overrideAccess: true,
      })
      created++
    }
  } catch {
    /* best-effort — email uniqueness may already be taken */
  }
  return created
}

/** Create a default working fiscal year for a tenant when none exists yet. */
async function ensureFiscalYear(payload: Payload, tenant: string): Promise<number | null> {
  const tid = toNum(tenant)
  try {
    const existing = await payload.find({
      collection: 'fiscal-years',
      where: { tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]?.id) return existing.docs[0].id as number

    const start = new Date('2026-07-16T00:00:00.000Z')
    const end = new Date('2027-07-15T00:00:00.000Z')
    const created = await payload.create({
      collection: 'fiscal-years',
      data: {
        label: '2083-84',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        status: 'active',
        isActive: true,
        tenant: tid,
      },
      overrideAccess: true,
    })
    return created.id as number
  } catch {
    return null
  }
}

async function ensureSeedParties(payload: Payload, tenant: string): Promise<{
  customer?: number
  both?: number
  vendor?: number
}> {
  const tid = toNum(tenant)
  const partyIds: { customer?: number; both?: number; vendor?: number } = {}
  for (const p of SEED_PARTIES) {
    const exists = await payload.find({
      collection: 'parties',
      where: { name: { equals: p.name }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    const id = exists.docs[0]?.id as number | undefined
    if (id) {
      if (p.type === 'customer') partyIds.customer = id
      if (p.type === 'both') partyIds.both = id
      if (p.type === 'vendor') partyIds.vendor = id
      continue
    }
    const created = await payload.create({
      collection: 'parties',
      data: { ...p, tenant: tid },
      overrideAccess: true,
    })
    const cid = created.id as number
    if (p.type === 'customer') partyIds.customer = cid
    if (p.type === 'both') partyIds.both = cid
    if (p.type === 'vendor') partyIds.vendor = cid
  }
  return partyIds
}

async function ensureSeedItems(payload: Payload, tenant: string): Promise<
  { id: number; name: string; salePrice: number; purchasePrice: number }[]
> {
  const tid = toNum(tenant)
  const items: { id: number; name: string; salePrice: number; purchasePrice: number }[] = []
  for (const it of SEED_ITEMS) {
    const exists = await payload.find({
      collection: 'items',
      where: { code: { equals: it.code }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (exists.docs[0]?.id) {
      const d = exists.docs[0] as any
      items.push({ id: d.id as number, name: d.name, salePrice: toNum(d.salePrice), purchasePrice: toNum(d.purchasePrice) })
      continue
    }
    const created = (await (payload.create as any)({
      collection: 'items',
      data: { ...it, tenant: tid },
      overrideAccess: true,
    })) as any
    items.push({
      id: created.id as number,
      name: created.name || it.name,
      salePrice: toNum(created.salePrice),
      purchasePrice: toNum(created.purchasePrice),
    })
  }
  return items
}

async function seedDraftVouchers(
  payload: Payload,
  tenant: string,
  vatId: number | null,
  parties: { customer: number; both: number; vendor: number },
  items: { id: number; name: string; salePrice: number; purchasePrice: number }[],
): Promise<string[]> {
  const made: string[] = []
  const tid = toNum(tenant)
  const rice = items.find((i) => i.name.toLowerCase().includes('rice'))
  const oil = items.find((i) => i.name.toLowerCase().includes('oil'))
  if (!rice || !oil) return made

  const vat = vatId ? [{ taxType: vatId, nature: 'additive', rate: 13 }] : []

  const drafts: any[] = [
    {
      docType: 'sales-invoice',
      date: new Date(Date.now() - 2 * 86400_000).toISOString(),
      party: parties.customer,
      status: 'draft',
      narration: 'Demo: wholesale sale of rice',
      lines: [{ item: rice.id, description: 'Rice (basmati)', qty: 100, rate: round2(rice.salePrice), amount: round2(100 * rice.salePrice) }],
      taxLines: vat,
    },
    {
      docType: 'purchase-invoice',
      date: new Date(Date.now() - 5 * 86400_000).toISOString(),
      party: parties.vendor,
      status: 'draft',
      narration: 'Demo: cooking oil purchase',
      lines: [{ item: oil.id, description: 'Cooking oil (sunflower)', qty: 50, rate: round2(oil.purchasePrice), amount: round2(50 * oil.purchasePrice) }],
      taxLines: vat,
    },
    {
      docType: 'receipt-voucher',
      date: new Date(Date.now() - 1 * 86400_000).toISOString(),
      party: parties.customer,
      status: 'draft',
      narration: 'Demo: advance receipt against invoice',
      lines: [{ description: 'Advance payment', amount: 2500 }],
    },
    {
      docType: 'payment-voucher',
      date: new Date(Date.now() - 3 * 86400_000).toISOString(),
      party: parties.vendor,
      status: 'draft',
      narration: 'Demo: partial payment to vendor',
      lines: [{ description: 'Payment against purchase invoice', amount: 5000 }],
    },
    {
      docType: 'membership-receipt',
      date: new Date(Date.now() - 4 * 86400_000).toISOString(),
      party: parties.both,
      status: 'draft',
      narration: 'Demo: annual membership fee',
      lines: [{ description: 'Annual membership fee', amount: 1500 }],
    },
  ]

  for (const doc of drafts) {
    try {
      const created = await payload.create({
        collection: 'documents',
        data: { ...doc, tenant: tid },
        overrideAccess: true,
      })
      made.push((created as any).number || String((created as any).id))
    } catch {
      /* a bad line must not abort the whole seed */
    }
  }
  return made
}

export const DataOps: CollectionConfig = {
  slug: 'data-ops',
  labels: { singular: 'Data Operation', plural: 'Data Operations' },
  admin: { hidden: true },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'kind',
      type: 'text',
      admin: { readOnly: true },
    },
  ],
  endpoints: [
    {
      path: '/cleanup',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const body = await readBody(req)
        const explicit = (body?.tenant as string) || null
        const tenant = targetTenant(req, explicit)
        if (!tenant) {
          return Response.json(
            { error: 'A tenant (ilaka) is required. Central users must pass an explicit tenant.' },
            { status: 400 },
          )
        }

        const counts: Record<string, number> = {}
        const failures: Record<string, number> = {}
        for (const slug of WIPE_COLLECTIONS) {
          const result = await wipeCollection(req.payload, slug, tenant)
          counts[slug] = result.deleted
          failures[slug] = result.errors
        }
        const sequencesReset = await resetSequences(req.payload, tenant)
        const epoch = await bumpEpoch(req.payload)
        await writeAudit(req.payload, req, tenant, 'cleanup', { counts, sequencesReset }, epoch)

        return Response.json({ ok: true, tenant, counts, failures, sequencesReset, epoch })
      },
    },
    {
      path: '/seed-demo',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const body = await readBody(req)
        const explicit = (body?.tenant as string) || null
        const tenant = targetTenant(req, explicit)
        if (!tenant) {
          return Response.json(
            { error: 'A tenant (ilaka) is required. Central users must pass an explicit tenant.' },
            { status: 400 },
          )
        }

        const settings = await getBillingSettings(req.payload)
        if (settings?.demoSeedEnabled === false) {
          return Response.json(
            { error: 'Demo data is disabled in Billing Settings → Features.' },
            { status: 403 },
          )
        }

        // Selective seeding: tell the endpoint which masters to create. When
        // `seeds` is absent we fall back to the legacy flag — chartOnly (accounts
        // + tax only, no parties/items/vouchers) or full demo seed.
        const chartOnly = body?.chartOnly === true
        const seeds: string[] | null = Array.isArray(body?.seeds)
          ? (body.seeds as string[]).map(String)
          : null
        const want = (key: string): boolean => {
          if (seeds) return seeds.includes(key)
          if (key === 'accounts' || key === 'taxTypes') return true
          if (chartOnly) return false
          return key !== 'members' && key !== 'fiscalYears'
        }

        const chart = want('accounts') ? await ensureChart(req.payload, tenant) : { groups: 0, accounts: 0 }
        const taxId = want('taxTypes') ? await ensureTaxType(req.payload, tenant) : null
        const defaultsApplied = want('accounts') ? await ensureDefaults(req.payload) : []

        let parties = { customer: 0, both: 0, vendor: 0 }
        let items: { id: number; name: string; salePrice: number; purchasePrice: number }[] = []
        let drafts: string[] = []
        if (want('parties')) {
          parties = (await ensureSeedParties(req.payload, tenant)) as { customer: number; both: number; vendor: number }
        }
        if (want('items')) {
          items = await ensureSeedItems(req.payload, tenant)
        }
        const wantVouchers = want('vouchers') || (!seeds && !chartOnly)
        if (wantVouchers && taxId != null && (partyCount(parties) > 0 || items.length > 0)) {
          drafts = await seedDraftVouchers(req.payload, tenant, taxId, parties, items)
        }

        const membershipTypes = want('members') ? await ensureMembershipTypes(req.payload) : []
        const membersCreated = want('members') ? await ensureMembers(req.payload, tenant) : 0
        const seededYear = want('fiscalYears') ? await ensureFiscalYear(req.payload, tenant) : null

        const epoch = await bumpEpoch(req.payload)
        await writeAudit(
          req.payload,
          req,
          tenant,
          'seed-demo',
          {
            chartOnly,
            seeds,
            chart,
            taxId,
            defaultsApplied,
            membershipTypes: membershipTypes.length,
            membersCreated,
            seededYear,
            draftCount: drafts.length,
          },
          epoch,
        )

        return Response.json({
          ok: true,
          tenant,
          chartOnly,
          seeds,
          chart,
          taxId,
          defaultsApplied,
          membershipTypes: membershipTypes.length,
          membersCreated,
          seededYear,
          partyCount: partyCount(parties),
          draftCount: drafts.length,
          drafts,
          epoch,
        })
      },
    },
  ],
}