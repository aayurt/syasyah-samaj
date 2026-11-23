import {
  isBillingUser,
  isCentralUser,
  isIllakaUser,
  resolveScopedTenant,
} from '@/access/tenantScoped'
import { isAdmin } from '@/access/admin'
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
 * POST /api/data-ops/reset   — full tenant reset: deletes transaction rows,
 *                              then masters (chart of accounts, account groups,
 *                              opening balances, parties, items, fiscal years),
 *                              keeping users, tenants/ilakas, members, tax types,
 *                              settings and the audit log. Admin-only, idempotent,
 *                              and blocked on production unless DATA_RESET_ENABLED.
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

/** Every business collection a full reset deletes — transaction rows first,
 * then masters — so foreign-key constraints never leave orphans. Kept:
 * users, tenants/ilakas, members, tax types, settings, audit log. */
export const RESET_COLLECTIONS = [
  'journal-entries', // references documents → wiped first
  'documents', // invoices, bills, receipts, payments
  'stock-movements', // references items/parties
  'bank-statements',
  'expense-claims',
  'recurring-schedules',
  'opening-balances', // references gl-accounts → wiped before accounts
  'fixed-assets',
  'gl-accounts', // chart of accounts → wiped before account groups
  'account-groups',
  'parties', // customers / suppliers
  'items', // products & services
  'fiscal-years',
] as const

/** Pending resets keyed by Idempotency-Key so a double submit returns the same result. */
const pendingResets = new Map<
  string,
  { status: 'in-flight' } | { status: 'done'; response: Response }
>()

const RESET_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000

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

const FOR_PROFIT_GROUPS = [
  { code: '1', name: 'Current Assets', type: 'asset' },
  { code: '2', name: 'Fixed Assets', type: 'asset' },
  { code: '3', name: 'Current Liabilities', type: 'liability' },
  { code: '4', name: 'Long-term Liabilities', type: 'liability' },
  { code: '5', name: 'Capital & Reserves', type: 'equity' },
  { code: '6', name: 'Income', type: 'income' },
  { code: '7', name: 'Direct Expenses', type: 'expense' },
  { code: '8', name: 'Indirect Expenses', type: 'expense' },
] as const

const NON_PROFIT_GROUPS = [
  { code: '1', name: 'Current Assets', type: 'asset' },
  { code: '2', name: 'Fixed Assets', type: 'asset' },
  { code: '3', name: 'Current Liabilities', type: 'liability' },
  { code: '4', name: 'Long-term Liabilities', type: 'liability' },
  { code: '5', name: 'Accumulated Funds & Reserves', type: 'equity' },
  { code: '6', name: 'Income & Contributions', type: 'income' },
  { code: '7', name: 'Programme Expenses', type: 'expense' },
  { code: '8', name: 'Administrative Expenses', type: 'expense' },
] as const

const FOR_PROFIT_ACCOUNTS = [
  { code: '1010', name: 'Cash in Hand', group: '1', type: 'asset', class: 'cash' },
  { code: '1020', name: 'Petty Cash', group: '1', type: 'asset', class: 'cash' },
  { code: '1030', name: 'Bank Account', group: '1', type: 'asset', class: 'bank' },
  { code: '1100', name: 'Accounts Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '1200', name: 'Inventory', group: '1', type: 'asset', class: 'other' },
  { code: '1300', name: 'Prepaid Expenses', group: '1', type: 'asset', class: 'other' },
  { code: '1400', name: 'VAT Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '2010', name: 'Land', group: '2', type: 'asset', class: 'other' },
  { code: '2020', name: 'Building', group: '2', type: 'asset', class: 'other' },
  { code: '2030', name: 'Furniture & Fixtures', group: '2', type: 'asset', class: 'other' },
  { code: '2040', name: 'Computer & Equipment', group: '2', type: 'asset', class: 'other' },
  { code: '2050', name: 'Vehicles', group: '2', type: 'asset', class: 'other' },
  { code: '2090', name: 'Accumulated Depreciation', group: '2', type: 'asset', class: 'other' },
  { code: '2100', name: 'Accounts Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2200', name: 'Accrued Expenses', group: '3', type: 'liability', class: 'other' },
  { code: '2300', name: 'VAT Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2400', name: 'Staff Payables', group: '3', type: 'liability', class: 'other' },
  { code: '2500', name: 'Customer Advances', group: '3', type: 'liability', class: 'other' },
  { code: '3100', name: 'Bank Loans', group: '4', type: 'liability', class: 'other' },
  { code: '3200', name: 'Other Long-term Loans', group: '4', type: 'liability', class: 'other' },
  { code: '4000', name: "Owner's Capital", group: '5', type: 'equity', class: 'other' },
  { code: '4100', name: 'Retained Earnings', group: '5', type: 'equity', class: 'other' },
  { code: '4200', name: 'Current Year Earnings', group: '5', type: 'equity', class: 'other' },
  { code: '5000', name: 'Sales Revenue', group: '6', type: 'income', class: 'other' },
  { code: '5100', name: 'Service Revenue', group: '6', type: 'income', class: 'other' },
  { code: '5200', name: 'Sales Returns', group: '6', type: 'income', class: 'other' },
  { code: '5300', name: 'Other Income', group: '6', type: 'income', class: 'other' },
  { code: '5400', name: 'Interest Income', group: '6', type: 'income', class: 'other' },
  { code: '6100', name: 'Purchases', group: '7', type: 'expense', class: 'other' },
  { code: '6200', name: 'Cost of Goods Sold', group: '7', type: 'expense', class: 'other' },
  { code: '6300', name: 'Purchase Returns', group: '7', type: 'expense', class: 'other' },
  { code: '6400', name: 'Freight & Carriage Inward', group: '7', type: 'expense', class: 'other' },
  { code: '7100', name: 'Rent Expense', group: '8', type: 'expense', class: 'other' },
  { code: '7200', name: 'Salaries & Wages', group: '8', type: 'expense', class: 'other' },
  { code: '7300', name: 'Utilities', group: '8', type: 'expense', class: 'other' },
  { code: '7400', name: 'Office Supplies', group: '8', type: 'expense', class: 'other' },
  { code: '7500', name: 'Transportation', group: '8', type: 'expense', class: 'other' },
  { code: '7600', name: 'Communication Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '7700', name: 'Marketing & Advertising', group: '8', type: 'expense', class: 'other' },
  { code: '7800', name: 'Audit & Professional Fees', group: '8', type: 'expense', class: 'other' },
  { code: '7900', name: 'Miscellaneous Expenses', group: '8', type: 'expense', class: 'other' },
] as const

const NON_PROFIT_ACCOUNTS = [
  { code: '1010', name: 'Cash in Hand', group: '1', type: 'asset', class: 'cash' },
  { code: '1020', name: 'Petty Cash', group: '1', type: 'asset', class: 'cash' },
  { code: '1030', name: 'Bank Account', group: '1', type: 'asset', class: 'bank' },
  { code: '1100', name: 'Member Receivables', group: '1', type: 'asset', class: 'other' },
  { code: '1110', name: 'Other Receivables', group: '1', type: 'asset', class: 'other' },
  { code: '1200', name: 'Inventory', group: '1', type: 'asset', class: 'other' },
  { code: '1300', name: 'Prepaid Expenses', group: '1', type: 'asset', class: 'other' },
  { code: '1400', name: 'VAT Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '2010', name: 'Land', group: '2', type: 'asset', class: 'other' },
  { code: '2020', name: 'Building', group: '2', type: 'asset', class: 'other' },
  { code: '2030', name: 'Furniture & Fixtures', group: '2', type: 'asset', class: 'other' },
  { code: '2040', name: 'Computer & Equipment', group: '2', type: 'asset', class: 'other' },
  { code: '2050', name: 'Vehicles', group: '2', type: 'asset', class: 'other' },
  { code: '2090', name: 'Accumulated Depreciation', group: '2', type: 'asset', class: 'other' },
  { code: '2100', name: 'Accounts Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2200', name: 'Accrued Expenses', group: '3', type: 'liability', class: 'other' },
  { code: '2300', name: 'VAT Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2400', name: 'Staff Payables', group: '3', type: 'liability', class: 'other' },
  { code: '2500', name: 'Refundable Member Deposits', group: '3', type: 'liability', class: 'other' },
  { code: '2600', name: 'Project Funds Payable', group: '3', type: 'liability', class: 'other' },
  { code: '3100', name: 'Long-term Loans', group: '4', type: 'liability', class: 'other' },
  { code: '3200', name: 'Other Long-term Liabilities', group: '4', type: 'liability', class: 'other' },
  { code: '4000', name: 'Opening Accumulated Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4100', name: 'General Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4200', name: 'Restricted Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4300', name: 'Capital Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4400', name: 'Reserve Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4500', name: 'Accumulated Surplus / Deficit', group: '5', type: 'equity', class: 'other' },
  { code: '4600', name: 'Current Year Surplus / Deficit', group: '5', type: 'equity', class: 'other' },
  { code: '5000', name: 'Membership Fees', group: '6', type: 'income', class: 'other' },
  { code: '5010', name: 'Annual Membership Renewal', group: '6', type: 'income', class: 'other' },
  { code: '5020', name: 'Member Contributions', group: '6', type: 'income', class: 'other' },
  { code: '5100', name: 'Donations', group: '6', type: 'income', class: 'other' },
  { code: '5110', name: 'Individual Donations', group: '6', type: 'income', class: 'other' },
  { code: '5120', name: 'Institutional Donations', group: '6', type: 'income', class: 'other' },
  { code: '5200', name: 'Grants Received', group: '6', type: 'income', class: 'other' },
  { code: '5210', name: 'Government Grants', group: '6', type: 'income', class: 'other' },
  { code: '5220', name: 'Project Grants', group: '6', type: 'income', class: 'other' },
  { code: '5300', name: 'Event Contributions', group: '6', type: 'income', class: 'other' },
  { code: '5400', name: 'Fundraising Income', group: '6', type: 'income', class: 'other' },
  { code: '5500', name: 'Interest Income', group: '6', type: 'income', class: 'other' },
  { code: '5900', name: 'Other Income', group: '6', type: 'income', class: 'other' },
  { code: '6100', name: 'Programme Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '6200', name: 'Project Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '6300', name: 'Event Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '6400', name: 'Community Development Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '6500', name: 'Social Welfare Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '6600', name: 'Education & Training Expenses', group: '7', type: 'expense', class: 'other' },
  { code: '7100', name: 'Salaries & Wages', group: '8', type: 'expense', class: 'other' },
  { code: '7200', name: 'Office Rent', group: '8', type: 'expense', class: 'other' },
  { code: '7300', name: 'Utilities', group: '8', type: 'expense', class: 'other' },
  { code: '7400', name: 'Office Supplies', group: '8', type: 'expense', class: 'other' },
  { code: '7500', name: 'Transportation', group: '8', type: 'expense', class: 'other' },
  { code: '7600', name: 'Communication Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '7700', name: 'Audit & Professional Fees', group: '8', type: 'expense', class: 'other' },
  { code: '7800', name: 'Administrative Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '7900', name: 'Miscellaneous Expenses', group: '8', type: 'expense', class: 'other' },
] as const

function groupsFor(orgType: 'FOR_PROFIT' | 'NON_PROFIT') {
  return orgType === 'FOR_PROFIT' ? FOR_PROFIT_GROUPS : NON_PROFIT_GROUPS
}

function accountsFor(orgType: 'FOR_PROFIT' | 'NON_PROFIT') {
  return orgType === 'FOR_PROFIT' ? FOR_PROFIT_ACCOUNTS : NON_PROFIT_ACCOUNTS
}

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

const SEED_TAX_TYPES = [
  { code: 'VAT', name: 'Value Added Tax', nature: 'additive', rate: 13, active: true },
  { code: 'TDS', name: 'Tax Deducted at Source', nature: 'withholding', rate: 1.5, active: true },
  { code: 'GST', name: 'Goods and Services Tax', nature: 'additive', rate: 18, active: true },
  { code: 'LUX', name: 'Luxury Tax', nature: 'additive', rate: 40, active: true },
] as const

async function ensureSeedTaxTypes(payload: Payload, tenant: string): Promise<{ created: number; ids: number[] }> {
  const tid = toNum(tenant)
  const ids: number[] = []
  let created = 0
  for (const t of SEED_TAX_TYPES) {
    const existing = await payload.find({
      collection: 'tax-types',
      where: { code: { equals: t.code }, tenant: { equals: tid } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]?.id) {
      ids.push(existing.docs[0].id as number)
      continue
    }
    const rec = await payload.create({
      collection: 'tax-types',
      data: { ...t, tenant: tid },
      overrideAccess: true,
    })
    ids.push(rec.id as number)
    created++
  }
  return { created, ids }
}

async function ensureAccountGroups(
  payload: Payload,
  tenant: string,
  orgType: 'FOR_PROFIT' | 'NON_PROFIT' = 'FOR_PROFIT',
): Promise<Record<string, number>> {
  const tid = toNum(tenant)
  const groupList = groupsFor(orgType)
  const groupIds: Record<string, number> = {}
  for (const g of groupList) {
    // Tenant-specific group first, then fall back to common (NULL tenant) group
    let existing = await payload.find({
      collection: 'account-groups',
      where: { code: { equals: g.code }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (!existing.docs[0]?.id) {
      existing = await payload.find({
        collection: 'account-groups',
        where: { code: { equals: g.code }, tenant: { equals: null } },
        limit: 1,
        depth: 0,
      })
    }
    if (existing.docs[0]?.id) {
      groupIds[g.code] = existing.docs[0].id as number
      continue
    }
    const created = await payload.create({
      collection: 'account-groups',
      data: { ...g, tenant: tid },
      overrideAccess: true,
    })
    groupIds[g.code] = created.id as number
  }
  return groupIds
}

async function ensureChart(
  payload: Payload,
  tenant: string,
  preExistingGroups?: Record<string, number>,
  orgType: 'FOR_PROFIT' | 'NON_PROFIT' = 'FOR_PROFIT',
): Promise<{ groups: number; accounts: number }> {
  const tid = toNum(tenant)
  const groupList = groupsFor(orgType)
  const accountList = accountsFor(orgType)
  const groupIds = preExistingGroups ?? await ensureAccountGroups(payload, tenant, orgType)
  let accountsCreated = 0
  for (const a of accountList) {
    if (!groupIds[a.code]) continue
    const existing = await payload.find({
      collection: 'gl-accounts',
      where: { code: { equals: a.code }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]?.id) continue
    await payload.create({
      collection: 'gl-accounts',
      data: { ...a, group: groupIds[a.code], tenant: tid },
      draft: true,
      overrideAccess: true,
    })
    accountsCreated++
  }
  return { groups: groupList.length, accounts: accountsCreated }
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
    create: ({ req }) => isBillingUser(req.user),
    read: ({ req }) => isBillingUser(req.user),
    update: ({ req }) => isBillingUser(req.user),
    delete: ({ req }) => isBillingUser(req.user),
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

        const chartOnly = body?.chartOnly === true
        const settings = await getBillingSettings(req.payload)
        const orgType = settings?.isProfitMaking === false ? 'NON_PROFIT' : 'FOR_PROFIT'
        if (!chartOnly && settings?.demoSeedEnabled === false) {
          return Response.json(
            { error: 'Demo data is disabled in Billing Settings → Features.' },
            { status: 403 },
          )
        }
        const seeds: string[] | null = Array.isArray(body?.seeds)
          ? (body.seeds as string[]).map(String)
          : null
        const want = (key: string): boolean => {
          if (seeds) return seeds.includes(key)
          if (key === 'accountGroups' || key === 'accounts' || key === 'taxTypes') return true
          if (chartOnly) return false
          return key !== 'members' && key !== 'fiscalYears'
        }

        const groupIds = want('accountGroups') ? await ensureAccountGroups(req.payload, tenant, orgType) : {}
        const groupsCreated = want('accountGroups') ? Object.keys(groupIds).length : 0
        const chart = want('accounts') ? await ensureChart(req.payload, tenant, groupIds, orgType) : { groups: 0, accounts: 0 }
        const taxTypes = want('taxTypes') ? await ensureSeedTaxTypes(req.payload, tenant) : { created: 0, ids: [] }
        const taxId = taxTypes.ids[0] ?? null
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
          groups: groupsCreated,
          chart,
          taxId,
          taxTypes: { created: taxTypes.created, count: taxTypes.ids.length },
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
    {
      path: '/reset',
      method: 'post',
      handler: async (req) => {
        if (!isAdmin({ req })) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const body = await readBody(req)
        const key =
          (req.headers.get('Idempotency-Key') as string) ||
          String(body?.requestId || '')
        if (key) {
          const cached = pendingResets.get(key)
          if (cached) {
            if (cached.status === 'done') return cached.response
            return Response.json(
              { error: 'A reset with this request id is already in progress.' },
              { status: 409 },
            )
          }
          pendingResets.set(key, { status: 'in-flight' })
        }

        // Production guard: full resets are off by default on production and
        // need both the DATA_RESET_ENABLED flag and an explicit body opt-in.
        if (
          process.env.NODE_ENV === 'production' &&
          (process.env.DATA_RESET_ENABLED !== 'true' ||
            body?.allowProductionReset !== true)
        ) {
          return Response.json(
            {
              error:
                'Full reset is disabled on production. Enable DATA_RESET_ENABLED on a designated test instance and retry with allowProductionReset: true.',
            },
            { status: 403 },
          )
        }

        const explicit = (body?.tenant as string) || null
        const tenant = targetTenant(req, explicit)
        if (!tenant) {
          return Response.json(
            { error: 'A tenant (ilaka) is required. Central users must pass an explicit tenant.' },
            { status: 400 },
          )
        }

        let counts: Record<string, number> = {}
        let failures: Record<string, number> = {}
        let sequencesReset = 0

        try {
          const wiped = await (req.payload as any).transaction(async (tx: any) => {
            const c: Record<string, number> = {}
            const f: Record<string, number> = {}
            for (const slug of RESET_COLLECTIONS) {
              const r = await wipeCollection(tx, slug, tenant)
              c[slug] = r.deleted
              f[slug] = r.errors
            }
            const s = await resetSequences(tx, tenant)
            return { counts: c, failures: f, sequencesReset: s }
          })
          counts = wiped.counts
          failures = wiped.failures
          sequencesReset = wiped.sequencesReset
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : 'Reset failed' },
            { status: 500 },
          )
        }

        const epoch = await bumpEpoch(req.payload)
        await writeAudit(req.payload, req, tenant, 'reset', {
          counts,
          failures,
          sequencesReset,
        }, epoch)

        const response = Response.json({
          ok: true,
          tenant,
          counts,
          failures,
          sequencesReset,
          epoch,
        })
        if (key) {
          pendingResets.set(key, { status: 'done', response })
          setTimeout(() => pendingResets.delete(key), RESET_IDEMPOTENCY_TTL_MS)
        }
        return response
      },
    },
  ],
}