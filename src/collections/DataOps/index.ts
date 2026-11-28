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
  { code: '6', name: 'Direct Income', type: 'income' },
  { code: '7', name: 'Indirect Income', type: 'income' },
  { code: '8', name: 'Direct Expenses', type: 'expense' },
  { code: '9', name: 'Indirect Expenses', type: 'expense' },
] as const

const NON_PROFIT_GROUPS = [
  { code: '1', name: 'Current Assets', type: 'asset' },
  { code: '2', name: 'Fixed Assets', type: 'asset' },
  { code: '3', name: 'Current Liabilities', type: 'liability' },
  { code: '4', name: 'Long-term Liabilities', type: 'liability' },
  { code: '5', name: 'Accumulated Funds & Reserves', type: 'equity' },
  { code: '6', name: 'Direct Income', type: 'income' },
  { code: '7', name: 'Indirect Income', type: 'income' },
  { code: '8', name: 'Direct Expenses', type: 'expense' },
  { code: '9', name: 'Indirect Expenses', type: 'expense' },
] as const

const FOR_PROFIT_ACCOUNTS = [
  // ── Group 1: Current Assets ──
  { code: '1010', name: 'Cash in Hand', group: '1', type: 'asset', class: 'cash' },
  { code: '1011', name: 'Main Cash Counter', group: '1', type: 'asset', class: 'cash', parentCode: '1010' },
  { code: '1012', name: 'Reception Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1010' },
  { code: '1020', name: 'Petty Cash', group: '1', type: 'asset', class: 'cash' },
  { code: '1021', name: 'Office Petty Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1020' },
  { code: '1022', name: 'Branch Petty Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1020' },
  { code: '1030', name: 'Bank Account', group: '1', type: 'asset', class: 'bank' },
  { code: '1031', name: 'Laxmi Sunrise Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '10311', name: 'Laxmi Sunrise Bank - Thamel Branch', group: '1', type: 'asset', class: 'bank', parentCode: '1031' },
  { code: '10312', name: 'Laxmi Sunrise Bank - Durbarmarg Branch', group: '1', type: 'asset', class: 'bank', parentCode: '1031' },
  { code: '1032', name: 'Sunrise Finance', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1033', name: 'Global IME Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1034', name: 'Nabil Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1035', name: 'NIC Asia Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1036', name: 'Himalayan Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1037', name: 'Nepal Investment Mega Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1038', name: 'Sanima Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1039', name: 'Siddhartha Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1040', name: 'Prabhu Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1041', name: 'Nepal Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1100', name: 'Accounts Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '1101', name: 'Local Customers', group: '1', type: 'asset', class: 'other', parentCode: '1100' },
  { code: '1102', name: 'Corporate Customers', group: '1', type: 'asset', class: 'other', parentCode: '1100' },
  { code: '1103', name: 'International Customers', group: '1', type: 'asset', class: 'other', parentCode: '1100' },
  { code: '1200', name: 'Inventory', group: '1', type: 'asset', class: 'other' },
  { code: '1201', name: 'Raw Materials', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1202', name: 'Finished Goods', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1203', name: 'Trading Goods', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1204', name: 'Consumables', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1300', name: 'Prepaid Expenses', group: '1', type: 'asset', class: 'other' },
  { code: '1301', name: 'Prepaid Rent', group: '1', type: 'asset', class: 'other', parentCode: '1300' },
  { code: '1302', name: 'Prepaid Insurance', group: '1', type: 'asset', class: 'other', parentCode: '1300' },
  { code: '1303', name: 'Prepaid Subscriptions', group: '1', type: 'asset', class: 'other', parentCode: '1300' },
  { code: '1400', name: 'VAT Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '1401', name: 'Input VAT on Purchases', group: '1', type: 'asset', class: 'other', parentCode: '1400' },
  { code: '1402', name: 'Input VAT on Expenses', group: '1', type: 'asset', class: 'other', parentCode: '1400' },

  // ── Group 2: Fixed Assets ──
  { code: '2010', name: 'Land', group: '2', type: 'asset', class: 'other' },
  { code: '2011', name: 'Office Land', group: '2', type: 'asset', class: 'other', parentCode: '2010' },
  { code: '2012', name: 'Commercial Land', group: '2', type: 'asset', class: 'other', parentCode: '2010' },
  { code: '2020', name: 'Building', group: '2', type: 'asset', class: 'other' },
  { code: '2021', name: 'Office Building', group: '2', type: 'asset', class: 'other', parentCode: '2020' },
  { code: '2022', name: 'Warehouse', group: '2', type: 'asset', class: 'other', parentCode: '2020' },
  { code: '2023', name: 'Commercial Building', group: '2', type: 'asset', class: 'other', parentCode: '2020' },
  { code: '2030', name: 'Furniture & Fixtures', group: '2', type: 'asset', class: 'other' },
  { code: '2031', name: 'Office Furniture', group: '2', type: 'asset', class: 'other', parentCode: '2030' },
  { code: '2032', name: 'Computer Desks', group: '2', type: 'asset', class: 'other', parentCode: '2030' },
  { code: '2033', name: 'Fixtures', group: '2', type: 'asset', class: 'other', parentCode: '2030' },
  { code: '2040', name: 'Computer & Equipment', group: '2', type: 'asset', class: 'other' },
  { code: '2041', name: 'Desktop Computers', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2042', name: 'Laptops', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2043', name: 'Printers', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2044', name: 'Networking Equipment', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2050', name: 'Vehicles', group: '2', type: 'asset', class: 'other' },
  { code: '2051', name: 'Cars', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2052', name: 'Motorcycles', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2053', name: 'Commercial Vehicles', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2090', name: 'Accumulated Depreciation', group: '2', type: 'asset', class: 'other', normalBalance: 'credit' },
  { code: '2091', name: 'Accumulated Depreciation - Buildings', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2092', name: 'Accumulated Depreciation - Furniture', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2093', name: 'Accumulated Depreciation - Equipment', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2094', name: 'Accumulated Depreciation - Vehicles', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },

  // ── Group 3: Current Liabilities ──
  { code: '2100', name: 'Accounts Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2101', name: 'Local Suppliers', group: '3', type: 'liability', class: 'other', parentCode: '2100' },
  { code: '2102', name: 'International Suppliers', group: '3', type: 'liability', class: 'other', parentCode: '2100' },
  { code: '2200', name: 'Accrued Expenses', group: '3', type: 'liability', class: 'other' },
  { code: '2201', name: 'Accrued Salaries', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2202', name: 'Accrued Rent', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2203', name: 'Accrued Utilities', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2300', name: 'VAT Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2301', name: 'Output VAT on Sales', group: '3', type: 'liability', class: 'other', parentCode: '2300' },
  { code: '2302', name: 'Output VAT on Services', group: '3', type: 'liability', class: 'other', parentCode: '2300' },
  { code: '2400', name: 'Staff Payables', group: '3', type: 'liability', class: 'other' },
  { code: '2401', name: 'Salary Payable', group: '3', type: 'liability', class: 'other', parentCode: '2400' },
  { code: '2402', name: 'Bonus Payable', group: '3', type: 'liability', class: 'other', parentCode: '2400' },
  { code: '2403', name: 'Reimbursement Payable', group: '3', type: 'liability', class: 'other', parentCode: '2400' },
  { code: '2500', name: 'Customer Advances', group: '3', type: 'liability', class: 'other' },
  { code: '2501', name: 'Advance from Customers', group: '3', type: 'liability', class: 'other', parentCode: '2500' },
  { code: '2502', name: 'Advance from Clients', group: '3', type: 'liability', class: 'other', parentCode: '2500' },

  // ── Group 4: Long-term Liabilities ──
  { code: '3100', name: 'Bank Loans', group: '4', type: 'liability', class: 'other' },
  { code: '3101', name: 'Business Loan', group: '4', type: 'liability', class: 'other', parentCode: '3100' },
  { code: '3102', name: 'Vehicle Loan', group: '4', type: 'liability', class: 'other', parentCode: '3100' },
  { code: '3103', name: 'Property Loan', group: '4', type: 'liability', class: 'other', parentCode: '3100' },
  { code: '3200', name: 'Other Long-term Loans', group: '4', type: 'liability', class: 'other' },
  { code: '3201', name: 'Director Loan', group: '4', type: 'liability', class: 'other', parentCode: '3200' },
  { code: '3202', name: 'Private Loan', group: '4', type: 'liability', class: 'other', parentCode: '3200' },
  { code: '3203', name: 'Institutional Loan', group: '4', type: 'liability', class: 'other', parentCode: '3200' },

  // ── Group 5: Capital & Reserves ──
  { code: '4000', name: "Owner's Capital", group: '5', type: 'equity', class: 'other' },
  { code: '4001', name: 'Owner 1 Capital', group: '5', type: 'equity', class: 'other', parentCode: '4000' },
  { code: '4002', name: 'Owner 2 Capital', group: '5', type: 'equity', class: 'other', parentCode: '4000' },
  { code: '4100', name: 'Retained Earnings', group: '5', type: 'equity', class: 'other' },
  { code: '4101', name: 'Previous Year Retained Earnings', group: '5', type: 'equity', class: 'other', parentCode: '4100' },
  { code: '4200', name: 'Current Year Earnings', group: '5', type: 'equity', class: 'other' },
  { code: '4201', name: 'Current Year Profit', group: '5', type: 'equity', class: 'other', parentCode: '4200' },
  { code: '4202', name: 'Current Year Loss', group: '5', type: 'equity', class: 'other', parentCode: '4200' },

  // ── Group 6: Direct Income ──
  { code: '5000', name: 'Sales Revenue', group: '6', type: 'income', class: 'other' },
  { code: '5001', name: 'Local Sales', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5002', name: 'Wholesale Sales', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5003', name: 'Retail Sales', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5004', name: 'Export Sales', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5100', name: 'Service Revenue', group: '6', type: 'income', class: 'other' },
  { code: '5101', name: 'Consulting Services', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5102', name: 'Software Development', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5103', name: 'Maintenance Services', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5200', name: 'Sales Returns', group: '6', type: 'income', class: 'other' },
  { code: '5201', name: 'Local Sales Returns', group: '6', type: 'income', class: 'other', parentCode: '5200' },
  { code: '5202', name: 'Export Sales Returns', group: '6', type: 'income', class: 'other', parentCode: '5200' },
  { code: '8010', name: 'Service Returns', group: '6', type: 'income', class: 'other' },
  { code: '8011', name: 'Service Refunds', group: '6', type: 'income', class: 'other', parentCode: '8010' },
  { code: '8012', name: 'Service Adjustments', group: '6', type: 'income', class: 'other', parentCode: '8010' },

  // ── Group 7: Indirect Income ──
  { code: '5300', name: 'Other Operating Income', group: '7', type: 'income', class: 'other' },
  { code: '5301', name: 'Scrap Sales', group: '7', type: 'income', class: 'other', parentCode: '5300' },
  { code: '5302', name: 'Recovery Income', group: '7', type: 'income', class: 'other', parentCode: '5300' },
  { code: '5400', name: 'Interest Income', group: '7', type: 'income', class: 'other' },
  { code: '5401', name: 'Bank Interest', group: '7', type: 'income', class: 'other', parentCode: '5400' },
  { code: '5402', name: 'Fixed Deposit Interest', group: '7', type: 'income', class: 'other', parentCode: '5400' },
  { code: '5500', name: 'Rental Income', group: '7', type: 'income', class: 'other' },
  { code: '5501', name: 'Building Rental', group: '7', type: 'income', class: 'other', parentCode: '5500' },
  { code: '5502', name: 'Equipment Rental', group: '7', type: 'income', class: 'other', parentCode: '5500' },
  { code: '5600', name: 'Commission Income', group: '7', type: 'income', class: 'other' },
  { code: '5601', name: 'Sales Commission', group: '7', type: 'income', class: 'other', parentCode: '5600' },
  { code: '5602', name: 'Referral Commission', group: '7', type: 'income', class: 'other', parentCode: '5600' },
  { code: '5700', name: 'Miscellaneous Income', group: '7', type: 'income', class: 'other' },
  { code: '5701', name: 'Other Non-operating Income', group: '7', type: 'income', class: 'other', parentCode: '5700' },

  // ── Group 8: Direct Expenses ──
  { code: '6100', name: 'Purchases', group: '8', type: 'expense', class: 'other' },
  { code: '6101', name: 'Local Purchases', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6102', name: 'Import Purchases', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6103', name: 'Trading Goods Purchases', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6200', name: 'Cost of Goods Sold', group: '8', type: 'expense', class: 'other' },
  { code: '6201', name: 'Product Cost', group: '8', type: 'expense', class: 'other', parentCode: '6200' },
  { code: '6202', name: 'Material Cost', group: '8', type: 'expense', class: 'other', parentCode: '6200' },
  { code: '6300', name: 'Purchase Returns', group: '8', type: 'expense', class: 'other' },
  { code: '6301', name: 'Local Purchase Returns', group: '8', type: 'expense', class: 'other', parentCode: '6300' },
  { code: '6302', name: 'Import Purchase Returns', group: '8', type: 'expense', class: 'other', parentCode: '6300' },
  { code: '6400', name: 'Freight & Carriage Inward', group: '8', type: 'expense', class: 'other' },
  { code: '6401', name: 'Local Freight', group: '8', type: 'expense', class: 'other', parentCode: '6400' },
  { code: '6402', name: 'Import Freight', group: '8', type: 'expense', class: 'other', parentCode: '6400' },
  { code: '6500', name: 'Direct Labour', group: '8', type: 'expense', class: 'other' },
  { code: '6501', name: 'Production Labour', group: '8', type: 'expense', class: 'other', parentCode: '6500' },
  { code: '6502', name: 'Project Labour', group: '8', type: 'expense', class: 'other', parentCode: '6500' },

  // ── Group 9: Indirect Expenses ──
  { code: '7100', name: 'Rent Expense', group: '9', type: 'expense', class: 'other' },
  { code: '7101', name: 'Office Rent', group: '9', type: 'expense', class: 'other', parentCode: '7100' },
  { code: '7102', name: 'Warehouse Rent', group: '9', type: 'expense', class: 'other', parentCode: '7100' },
  { code: '7200', name: 'Salaries & Wages', group: '9', type: 'expense', class: 'other' },
  { code: '7201', name: 'Management Salaries', group: '9', type: 'expense', class: 'other', parentCode: '7200' },
  { code: '7202', name: 'Administrative Salaries', group: '9', type: 'expense', class: 'other', parentCode: '7200' },
  { code: '7203', name: 'Staff Wages', group: '9', type: 'expense', class: 'other', parentCode: '7200' },
  { code: '7300', name: 'Utilities', group: '9', type: 'expense', class: 'other' },
  { code: '7301', name: 'Electricity', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7302', name: 'Water', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7303', name: 'Internet', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7400', name: 'Office Supplies', group: '9', type: 'expense', class: 'other' },
  { code: '7401', name: 'Stationery', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7402', name: 'Printing', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7403', name: 'Office Consumables', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7500', name: 'Transportation', group: '9', type: 'expense', class: 'other' },
  { code: '7501', name: 'Fuel', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7502', name: 'Vehicle Maintenance', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7503', name: 'Travel Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7600', name: 'Communication Expenses', group: '9', type: 'expense', class: 'other' },
  { code: '7601', name: 'Telephone', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7602', name: 'Internet', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7603', name: 'Postal Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7700', name: 'Marketing & Advertising', group: '9', type: 'expense', class: 'other' },
  { code: '7701', name: 'Digital Marketing', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7702', name: 'Advertising', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7703', name: 'Promotions', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7800', name: 'Audit & Professional Fees', group: '9', type: 'expense', class: 'other' },
  { code: '7801', name: 'Audit Fees', group: '9', type: 'expense', class: 'other', parentCode: '7800' },
  { code: '7802', name: 'Legal Fees', group: '9', type: 'expense', class: 'other', parentCode: '7800' },
  { code: '7803', name: 'Consultancy Fees', group: '9', type: 'expense', class: 'other', parentCode: '7800' },
  { code: '7900', name: 'Miscellaneous Expenses', group: '9', type: 'expense', class: 'other' },
  { code: '7901', name: 'General Miscellaneous Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7900' },
] as const

const NON_PROFIT_ACCOUNTS = [
  // ── Group 1: Current Assets ──
  { code: '1010', name: 'Cash in Hand', group: '1', type: 'asset', class: 'cash' },
  { code: '1011', name: 'Main Cash Counter', group: '1', type: 'asset', class: 'cash', parentCode: '1010' },
  { code: '1012', name: 'Programme Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1010' },
  { code: '1020', name: 'Petty Cash', group: '1', type: 'asset', class: 'cash' },
  { code: '1021', name: 'Office Petty Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1020' },
  { code: '1022', name: 'Project Petty Cash', group: '1', type: 'asset', class: 'cash', parentCode: '1020' },
  { code: '1030', name: 'Bank Account', group: '1', type: 'asset', class: 'bank' },
  { code: '1031', name: 'Laxmi Sunrise Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '10311', name: 'Laxmi Sunrise Bank - Thamel Branch', group: '1', type: 'asset', class: 'bank', parentCode: '1031' },
  { code: '10312', name: 'Laxmi Sunrise Bank - Durbarmarg Branch', group: '1', type: 'asset', class: 'bank', parentCode: '1031' },
  { code: '1032', name: 'Sunrise Finance', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1033', name: 'Global IME Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1034', name: 'Nabil Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1035', name: 'NIC Asia Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1036', name: 'Himalayan Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1037', name: 'Nepal Investment Mega Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1038', name: 'Sanima Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1039', name: 'Siddhartha Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1040', name: 'Nepal Bank', group: '1', type: 'asset', class: 'bank', parentCode: '1030' },
  { code: '1100', name: 'Member Receivables', group: '1', type: 'asset', class: 'other' },
  { code: '1101', name: 'Annual Membership Due', group: '1', type: 'asset', class: 'other', parentCode: '1100' },
  { code: '1102', name: 'Lifetime Membership Due', group: '1', type: 'asset', class: 'other', parentCode: '1100' },
  { code: '1110', name: 'Other Receivables', group: '1', type: 'asset', class: 'other' },
  { code: '1111', name: 'Staff Advances', group: '1', type: 'asset', class: 'other', parentCode: '1110' },
  { code: '1112', name: 'Project Advances', group: '1', type: 'asset', class: 'other', parentCode: '1110' },
  { code: '1113', name: 'Other Receivables', group: '1', type: 'asset', class: 'other', parentCode: '1110' },
  { code: '1200', name: 'Inventory', group: '1', type: 'asset', class: 'other' },
  { code: '1201', name: 'Event Materials', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1202', name: 'Office Consumables', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1203', name: 'Distribution Materials', group: '1', type: 'asset', class: 'other', parentCode: '1200' },
  { code: '1300', name: 'Prepaid Expenses', group: '1', type: 'asset', class: 'other' },
  { code: '1301', name: 'Prepaid Rent', group: '1', type: 'asset', class: 'other', parentCode: '1300' },
  { code: '1302', name: 'Prepaid Insurance', group: '1', type: 'asset', class: 'other', parentCode: '1300' },
  { code: '1400', name: 'VAT Receivable', group: '1', type: 'asset', class: 'other' },
  { code: '1401', name: 'Input VAT on Purchases', group: '1', type: 'asset', class: 'other', parentCode: '1400' },
  { code: '1402', name: 'Input VAT on Expenses', group: '1', type: 'asset', class: 'other', parentCode: '1400' },

  // ── Group 2: Fixed Assets ──
  { code: '2010', name: 'Land', group: '2', type: 'asset', class: 'other' },
  { code: '2011', name: 'Office Land', group: '2', type: 'asset', class: 'other', parentCode: '2010' },
  { code: '2012', name: 'Community Land', group: '2', type: 'asset', class: 'other', parentCode: '2010' },
  { code: '2020', name: 'Building', group: '2', type: 'asset', class: 'other' },
  { code: '2021', name: 'Office Building', group: '2', type: 'asset', class: 'other', parentCode: '2020' },
  { code: '2022', name: 'Community Hall', group: '2', type: 'asset', class: 'other', parentCode: '2020' },
  { code: '2030', name: 'Furniture & Fixtures', group: '2', type: 'asset', class: 'other' },
  { code: '2031', name: 'Office Furniture', group: '2', type: 'asset', class: 'other', parentCode: '2030' },
  { code: '2032', name: 'Meeting Hall Furniture', group: '2', type: 'asset', class: 'other', parentCode: '2030' },
  { code: '2040', name: 'Computer & Equipment', group: '2', type: 'asset', class: 'other' },
  { code: '2041', name: 'Desktop Computers', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2042', name: 'Laptops', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2043', name: 'Printers', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2044', name: 'Networking Equipment', group: '2', type: 'asset', class: 'other', parentCode: '2040' },
  { code: '2050', name: 'Vehicles', group: '2', type: 'asset', class: 'other' },
  { code: '2051', name: 'Cars', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2052', name: 'Motorcycles', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2053', name: 'Community Vehicles', group: '2', type: 'asset', class: 'other', parentCode: '2050' },
  { code: '2090', name: 'Accumulated Depreciation', group: '2', type: 'asset', class: 'other', normalBalance: 'credit' },
  { code: '2091', name: 'Accumulated Depreciation - Buildings', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2092', name: 'Accumulated Depreciation - Furniture', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2093', name: 'Accumulated Depreciation - Equipment', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },
  { code: '2094', name: 'Accumulated Depreciation - Vehicles', group: '2', type: 'asset', class: 'other', parentCode: '2090', normalBalance: 'credit' },

  // ── Group 3: Current Liabilities ──
  { code: '2100', name: 'Accounts Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2101', name: 'Local Suppliers', group: '3', type: 'liability', class: 'other', parentCode: '2100' },
  { code: '2102', name: 'Other Suppliers', group: '3', type: 'liability', class: 'other', parentCode: '2100' },
  { code: '2200', name: 'Accrued Expenses', group: '3', type: 'liability', class: 'other' },
  { code: '2201', name: 'Accrued Salaries', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2202', name: 'Accrued Rent', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2203', name: 'Accrued Utilities', group: '3', type: 'liability', class: 'other', parentCode: '2200' },
  { code: '2300', name: 'VAT Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2301', name: 'Output VAT on Sales', group: '3', type: 'liability', class: 'other', parentCode: '2300' },
  { code: '2302', name: 'Output VAT on Services', group: '3', type: 'liability', class: 'other', parentCode: '2300' },
  { code: '2400', name: 'Staff Payables', group: '3', type: 'liability', class: 'other' },
  { code: '2401', name: 'Salary Payable', group: '3', type: 'liability', class: 'other', parentCode: '2400' },
  { code: '2402', name: 'Reimbursement Payable', group: '3', type: 'liability', class: 'other', parentCode: '2400' },
  { code: '2500', name: 'Refundable Deposits', group: '3', type: 'liability', class: 'other' },
  { code: '2501', name: 'Refundable Security Deposits', group: '3', type: 'liability', class: 'other', parentCode: '2500' },
  { code: '2502', name: 'Refundable Membership Deposits', group: '3', type: 'liability', class: 'other', parentCode: '2500' },
  { code: '2600', name: 'Project Funds Payable', group: '3', type: 'liability', class: 'other' },
  { code: '2601', name: 'Unspent Project Advances', group: '3', type: 'liability', class: 'other', parentCode: '2600' },
  { code: '2602', name: 'Refundable Grant Balances', group: '3', type: 'liability', class: 'other', parentCode: '2600' },

  // ── Group 4: Long-term Liabilities ──
  { code: '3100', name: 'Long-term Loans', group: '4', type: 'liability', class: 'other' },
  { code: '3101', name: 'Institutional Loans', group: '4', type: 'liability', class: 'other', parentCode: '3100' },
  { code: '3102', name: 'Bank Loans', group: '4', type: 'liability', class: 'other', parentCode: '3100' },
  { code: '3200', name: 'Other Long-term Liabilities', group: '4', type: 'liability', class: 'other' },
  { code: '3201', name: 'Other Long-term Obligations', group: '4', type: 'liability', class: 'other', parentCode: '3200' },

  // ── Group 5: Accumulated Funds & Reserves ──
  { code: '4000', name: 'Opening Accumulated Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4001', name: 'Opening General Fund', group: '5', type: 'equity', class: 'other', parentCode: '4000' },
  { code: '4002', name: 'Opening Restricted Fund', group: '5', type: 'equity', class: 'other', parentCode: '4000' },
  { code: '4100', name: 'General Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4101', name: 'Unrestricted General Fund', group: '5', type: 'equity', class: 'other', parentCode: '4100' },
  { code: '4200', name: 'Restricted Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4201', name: 'Donor Restricted Fund', group: '5', type: 'equity', class: 'other', parentCode: '4200' },
  { code: '4202', name: 'Project Restricted Fund', group: '5', type: 'equity', class: 'other', parentCode: '4200' },
  { code: '4300', name: 'Capital Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4301', name: 'Building Capital Fund', group: '5', type: 'equity', class: 'other', parentCode: '4300' },
  { code: '4302', name: 'Equipment Capital Fund', group: '5', type: 'equity', class: 'other', parentCode: '4300' },
  { code: '4400', name: 'Reserve Fund', group: '5', type: 'equity', class: 'other' },
  { code: '4401', name: 'Emergency Reserve', group: '5', type: 'equity', class: 'other', parentCode: '4400' },
  { code: '4402', name: 'General Reserve', group: '5', type: 'equity', class: 'other', parentCode: '4400' },
  { code: '4500', name: 'Accumulated Surplus / Deficit', group: '5', type: 'equity', class: 'other' },
  { code: '4501', name: 'Prior Year Surplus', group: '5', type: 'equity', class: 'other', parentCode: '4500' },
  { code: '4502', name: 'Prior Year Deficit', group: '5', type: 'equity', class: 'other', parentCode: '4500' },
  { code: '4600', name: 'Current Year Surplus / Deficit', group: '5', type: 'equity', class: 'other' },
  { code: '4601', name: 'Current Year Surplus', group: '5', type: 'equity', class: 'other', parentCode: '4600' },
  { code: '4602', name: 'Current Year Deficit', group: '5', type: 'equity', class: 'other', parentCode: '4600' },

  // ── Group 6: Direct Income ──
  { code: '5000', name: 'Membership Fees', group: '6', type: 'income', class: 'other' },
  { code: '5001', name: 'General Membership Fees', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5002', name: 'Associate Membership Fees', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5003', name: 'Lifetime Membership Fees', group: '6', type: 'income', class: 'other', parentCode: '5000' },
  { code: '5010', name: 'Annual Membership Renewal', group: '6', type: 'income', class: 'other' },
  { code: '5011', name: 'Regular Membership Renewal', group: '6', type: 'income', class: 'other', parentCode: '5010' },
  { code: '5012', name: 'Institutional Membership Renewal', group: '6', type: 'income', class: 'other', parentCode: '5010' },
  { code: '5020', name: 'Member Contributions', group: '6', type: 'income', class: 'other' },
  { code: '5021', name: 'General Contributions', group: '6', type: 'income', class: 'other', parentCode: '5020' },
  { code: '5022', name: 'Special Contributions', group: '6', type: 'income', class: 'other', parentCode: '5020' },
  { code: '5100', name: 'Programme Contributions', group: '6', type: 'income', class: 'other' },
  { code: '5101', name: 'Education Contributions', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5102', name: 'Social Welfare Contributions', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5103', name: 'Community Contributions', group: '6', type: 'income', class: 'other', parentCode: '5100' },
  { code: '5110', name: 'Donations', group: '6', type: 'income', class: 'other' },
  { code: '5111', name: 'General Donations', group: '6', type: 'income', class: 'other', parentCode: '5110' },
  { code: '5112', name: 'Specific Purpose Donations', group: '6', type: 'income', class: 'other', parentCode: '5110' },
  { code: '5120', name: 'Individual Donations', group: '6', type: 'income', class: 'other' },
  { code: '5121', name: 'Local Individual Donations', group: '6', type: 'income', class: 'other', parentCode: '5120' },
  { code: '5122', name: 'International Individual Donations', group: '6', type: 'income', class: 'other', parentCode: '5120' },
  { code: '5130', name: 'Institutional Donations', group: '6', type: 'income', class: 'other' },
  { code: '5131', name: 'Corporate Donations', group: '6', type: 'income', class: 'other', parentCode: '5130' },
  { code: '5132', name: 'Institutional Donations', group: '6', type: 'income', class: 'other', parentCode: '5130' },
  { code: '5200', name: 'Project Grants', group: '6', type: 'income', class: 'other' },
  { code: '5201', name: 'Community Development Grants', group: '6', type: 'income', class: 'other', parentCode: '5200' },
  { code: '5202', name: 'Education Project Grants', group: '6', type: 'income', class: 'other', parentCode: '5200' },
  { code: '5203', name: 'Welfare Project Grants', group: '6', type: 'income', class: 'other', parentCode: '5200' },
  { code: '5210', name: 'Government Grants', group: '6', type: 'income', class: 'other' },
  { code: '5211', name: 'Federal Government Grants', group: '6', type: 'income', class: 'other', parentCode: '5210' },
  { code: '5212', name: 'Provincial Government Grants', group: '6', type: 'income', class: 'other', parentCode: '5210' },
  { code: '5213', name: 'Local Government Grants', group: '6', type: 'income', class: 'other', parentCode: '5210' },
  { code: '5220', name: 'Institutional Grants', group: '6', type: 'income', class: 'other' },
  { code: '5221', name: 'NGO Grants', group: '6', type: 'income', class: 'other', parentCode: '5220' },
  { code: '5222', name: 'INGO Grants', group: '6', type: 'income', class: 'other', parentCode: '5220' },
  { code: '5223', name: 'Foundation Grants', group: '6', type: 'income', class: 'other', parentCode: '5220' },
  { code: '5300', name: 'Event Contributions', group: '6', type: 'income', class: 'other' },
  { code: '5301', name: 'Annual Event Contributions', group: '6', type: 'income', class: 'other', parentCode: '5300' },
  { code: '5302', name: 'Special Event Contributions', group: '6', type: 'income', class: 'other', parentCode: '5300' },
  { code: '5400', name: 'Fundraising Income', group: '6', type: 'income', class: 'other' },
  { code: '5401', name: 'Fundraising Events', group: '6', type: 'income', class: 'other', parentCode: '5400' },
  { code: '5402', name: 'Campaign Contributions', group: '6', type: 'income', class: 'other', parentCode: '5400' },

  // ── Group 7: Indirect Income ──
  { code: '5500', name: 'Interest Income', group: '7', type: 'income', class: 'other' },
  { code: '5501', name: 'Bank Interest', group: '7', type: 'income', class: 'other', parentCode: '5500' },
  { code: '5502', name: 'Fixed Deposit Interest', group: '7', type: 'income', class: 'other', parentCode: '5500' },
  { code: '5600', name: 'Rental Income', group: '7', type: 'income', class: 'other' },
  { code: '5601', name: 'Building Rental', group: '7', type: 'income', class: 'other', parentCode: '5600' },
  { code: '5602', name: 'Hall Rental', group: '7', type: 'income', class: 'other', parentCode: '5600' },
  { code: '5700', name: 'Miscellaneous Income', group: '7', type: 'income', class: 'other' },
  { code: '5701', name: 'Other Miscellaneous Income', group: '7', type: 'income', class: 'other', parentCode: '5700' },
  { code: '5900', name: 'Other Non-operating Income', group: '7', type: 'income', class: 'other' },
  { code: '5901', name: 'Gain on Asset Disposal', group: '7', type: 'income', class: 'other', parentCode: '5900' },
  { code: '5902', name: 'Other Non-operating Receipts', group: '7', type: 'income', class: 'other', parentCode: '5900' },

  // ── Group 8: Direct Expenses ──
  { code: '6100', name: 'Programme Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6101', name: 'Education Programme Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6102', name: 'Health Programme Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6103', name: 'Social Welfare Programme Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6100' },
  { code: '6200', name: 'Project Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6201', name: 'Community Development Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6200' },
  { code: '6202', name: 'Infrastructure Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6200' },
  { code: '6203', name: 'Training Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6200' },
  { code: '6300', name: 'Event Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6301', name: 'AGM Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6300' },
  { code: '6302', name: 'Cultural Event Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6300' },
  { code: '6303', name: 'Community Event Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6300' },
  { code: '6400', name: 'Community Development Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6401', name: 'Infrastructure Support', group: '8', type: 'expense', class: 'other', parentCode: '6400' },
  { code: '6402', name: 'Community Support', group: '8', type: 'expense', class: 'other', parentCode: '6400' },
  { code: '6500', name: 'Social Welfare Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6501', name: 'Financial Assistance', group: '8', type: 'expense', class: 'other', parentCode: '6500' },
  { code: '6502', name: 'Relief Distribution', group: '8', type: 'expense', class: 'other', parentCode: '6500' },
  { code: '6503', name: 'Social Support', group: '8', type: 'expense', class: 'other', parentCode: '6500' },
  { code: '6600', name: 'Education & Training Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6601', name: 'Scholarships', group: '8', type: 'expense', class: 'other', parentCode: '6600' },
  { code: '6602', name: 'Training Materials', group: '8', type: 'expense', class: 'other', parentCode: '6600' },
  { code: '6603', name: 'Workshops', group: '8', type: 'expense', class: 'other', parentCode: '6600' },
  { code: '6700', name: 'Direct Project Personnel Expenses', group: '8', type: 'expense', class: 'other' },
  { code: '6701', name: 'Project Staff Salaries', group: '8', type: 'expense', class: 'other', parentCode: '6700' },
  { code: '6702', name: 'Project Consultants', group: '8', type: 'expense', class: 'other', parentCode: '6700' },
  { code: '6703', name: 'Field Staff Expenses', group: '8', type: 'expense', class: 'other', parentCode: '6700' },

  // ── Group 9: Indirect Expenses ──
  { code: '7100', name: 'Salaries & Wages', group: '9', type: 'expense', class: 'other' },
  { code: '7101', name: 'Management Salaries', group: '9', type: 'expense', class: 'other', parentCode: '7100' },
  { code: '7102', name: 'Administrative Salaries', group: '9', type: 'expense', class: 'other', parentCode: '7100' },
  { code: '7103', name: 'Staff Wages', group: '9', type: 'expense', class: 'other', parentCode: '7100' },
  { code: '7200', name: 'Office Rent', group: '9', type: 'expense', class: 'other' },
  { code: '7201', name: 'Office Rent', group: '9', type: 'expense', class: 'other', parentCode: '7200' },
  { code: '7202', name: 'Hall Rent', group: '9', type: 'expense', class: 'other', parentCode: '7200' },
  { code: '7300', name: 'Utilities', group: '9', type: 'expense', class: 'other' },
  { code: '7301', name: 'Electricity', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7302', name: 'Water', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7303', name: 'Internet', group: '9', type: 'expense', class: 'other', parentCode: '7300' },
  { code: '7400', name: 'Office Supplies', group: '9', type: 'expense', class: 'other' },
  { code: '7401', name: 'Stationery', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7402', name: 'Printing', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7403', name: 'Office Consumables', group: '9', type: 'expense', class: 'other', parentCode: '7400' },
  { code: '7500', name: 'Transportation', group: '9', type: 'expense', class: 'other' },
  { code: '7501', name: 'Fuel', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7502', name: 'Vehicle Maintenance', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7503', name: 'Travel Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7500' },
  { code: '7600', name: 'Communication Expenses', group: '9', type: 'expense', class: 'other' },
  { code: '7601', name: 'Telephone', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7602', name: 'Internet', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7603', name: 'Postal Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7600' },
  { code: '7700', name: 'Audit & Professional Fees', group: '9', type: 'expense', class: 'other' },
  { code: '7701', name: 'Audit Fees', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7702', name: 'Legal Fees', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7703', name: 'Consultancy Fees', group: '9', type: 'expense', class: 'other', parentCode: '7700' },
  { code: '7800', name: 'Administrative Expenses', group: '9', type: 'expense', class: 'other' },
  { code: '7801', name: 'General Administrative Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7800' },
  { code: '7900', name: 'Miscellaneous Expenses', group: '9', type: 'expense', class: 'other' },
  { code: '7901', name: 'General Miscellaneous Expenses', group: '9', type: 'expense', class: 'other', parentCode: '7900' },
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
  const groupIds =
    preExistingGroups && Object.keys(preExistingGroups).length > 0
      ? preExistingGroups
      : await ensureAccountGroups(payload, tenant, orgType)
  let accountsCreated = 0
  // Track created accounts by code so child accounts can resolve their parent.
  const createdByCode = new Map<string, number>()
  for (const a of accountList) {
    if (!groupIds[a.group]) continue
    const existing = await payload.find({
      collection: 'gl-accounts',
      where: { code: { equals: a.code }, tenant: { equals: tenant } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]?.id) {
      // Also index pre-existing accounts so later children can link to them.
      createdByCode.set(a.code, existing.docs[0].id as number)
      continue
    }
    const defaultNormal = ['liability', 'equity', 'income'].includes(a.type) ? 'credit' : 'debit'
    const normalBalance = (a as any).normalBalance || (a.code === '2090' ? 'credit' : defaultNormal)

    const entry = a as { code: string; parentCode?: string; normalBalance?: string; [key: string]: unknown }
    // Resolve parentCode → parent account ID.
    let parentId: number | null = null
    if (entry.parentCode) {
      parentId = createdByCode.get(String(entry.parentCode)) ?? null
      if (!parentId) {
        // Parent may exist in DB from an earlier seed run; look it up.
        const parentRes = await payload.find({
          collection: 'gl-accounts',
          where: { code: { equals: entry.parentCode }, tenant: { equals: tenant } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (parentRes.docs[0]?.id) {
          parentId = parentRes.docs[0].id as number
          createdByCode.set(entry.parentCode, parentId)
        }
      }
    }

    const { parentCode, ...dataWithoutParentCode } = entry
    const createdAcct = await payload.create({
      collection: 'gl-accounts',
      data: { ...dataWithoutParentCode, group: groupIds[a.group], parent: parentId, normalBalance: entry.normalBalance as 'debit' | 'credit' | null | undefined, tenant: tid },
      draft: true,
      overrideAccess: true,
    })
    createdByCode.set(a.code, createdAcct.id as number)
    accountsCreated++
  }
  return { groups: groupList.length, accounts: accountsCreated }
}

/** Fill only the default-account slots that are still unset (never clobber). */
async function ensureDefaults(payload: Payload): Promise<string[]> {
  const settings = await getBillingSettings(payload)
  const mapping: Record<string, string> = {
    receivableAccount: '1100',
    payableAccount: '2100',
    cashAccount: '1010',
    bankAccount: '1030',
    taxAccount: '2300',
    inventoryAccount: '1200',
    revenueAccount: '5000',
    expenseAccount: '6100',
    cogsAccount: '6200',
    returnsAccount: '5200',
    membershipFeeAccount: '5000',
    donationAccount: '5100',
    depreciationAccount: '7900',
    accumulatedDepreciationAccount: '2090',
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

        const groupIds =
          want('accountGroups') || want('accounts')
            ? await ensureAccountGroups(req.payload, tenant, orgType)
            : {}
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