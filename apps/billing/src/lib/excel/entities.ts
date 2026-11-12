/**
 * Entity registry — the single source of truth for Excel import/export
 * (MISSION.md M1, ADR-0004).
 *
 * One entry per accounting collection:
 *   slug (real Payload API slug) · sheet name · columns · dedup keys ·
 *   FK links · import order (masters before transactions) · validator
 *
 * Consumers:
 *   - importExport.ts  → derives EXPORT_COLUMNS / EXPORT_CONFIGS / DEDUP_KEYS
 *   - excel/entityIo.ts (M2) → per-entity workbook build/parse + templates
 *   - excel/masterWorkbook.ts (M4) → one sheet per registry entry
 *
 * Column keys are the *canonical import/export field space*: flat names
 * (dotted paths for nested payload fields), NOT raw API ids for relations —
 * relations carry their business key (code/name/number) and are resolved to
 * ids at execute time (M3).
 */

export interface ExcelExportColumn {
  key: string
  header: string
  width?: number
  /** Dotted path in the API doc when it differs from `key` (export reads it). */
  source?: string
}

export type ValidationError = {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

/** Per-import helpers handed to `mapForApi` implementations. */
export type ImportContext = {
  /** Business key → existing record id (populated from fkLinks refs). */
  findId(refSlug: string, refField: string, value: unknown): number | undefined
  /** Record an unresolved reference; the row is skipped with this error. */
  missing(refSlug: string, field: string, value: unknown): void
  /** Drain recorded resolution failures for the current record. */
  takeMissing(): string[]
}

export interface EntityExcelConfig {
  /** Real Payload collection slug (e.g. 'gl-accounts' — never 'accounts'). */
  slug: string
  /** Excel sheet name (≤31 chars, no []:*?/\). */
  sheetName: string
  /** Human label for UI (English; Nepali copy added via i18n keys later). */
  label: string
  kind: 'master' | 'transaction'
  /** Dependency order for master-workbook import — masters all < transactions. */
  importOrder: number
  /** Canonical flat columns (export headers + import field names). */
  columns: ExcelExportColumn[]
  /** Business keys for tier-2 dedup; must reference `columns` keys. */
  dedupKeys: { key: string; field: string }[]
  /** Normalized-header → canonical-field overrides applied on import (M3). */
  headerAliases?: Record<string, string>
  /**
   * Cross-sheet links: this entity's field → referenced entity + column.
   * `to` names the payload field when it differs from `field`
   * (e.g. accountCode → account).
   */
  fkLinks?: { field: string; refSlug: string; refField: string; to?: string }[]
  /** Chart of accounts is rendered/grouped hierarchically in Excel. */
  isHierarchical?: boolean
  /** Rows sharing this key are grouped into ONE API doc before write (journal). */
  groupBy?: string
  /** Fields coerced from Excel/CSV truthy strings to real booleans. */
  booleanFields?: string[]
  /** Canonical doc → payload write shape (nesting, line regrouping). */
  mapForApi?: (doc: Record<string, unknown>, ctx: ImportContext) => Record<string, unknown>
  /** Expand one API doc into row(s) before writing (journal lines → rows). */
  expand?: (doc: Record<string, unknown>) => Record<string, unknown>[]
  /** One example row for the downloadable template (marked "delete me"). */
  example?: Record<string, unknown>
  /** Row validator used by the import preview. */
  validate?: (doc: Record<string, unknown>) => ValidationError[]
}

const col = (key: string, header: string, width: number): ExcelExportColumn => ({ key, header, width })
const src = (key: string, header: string, width: number, source: string): ExcelExportColumn => ({
  key,
  header,
  width,
  source,
})
const keys = (...ks: string[]) => ks.map((key) => ({ key, field: key }))

/* ── Validators (moved from importExport.validateImportRows, same rules) ── */

const requireField = (field: string, message: string) => (doc: Record<string, unknown>) =>
  !doc[field] || String(doc[field]).trim() === ''
    ? [{ row: 0, field, message, severity: 'error' as const }]
    : []

function validateMembers(doc: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []
  if (!doc.fullName || String(doc.fullName).trim() === '') {
    errors.push({ row: 0, field: 'fullName', message: 'Full name is required', severity: 'error' })
  }
  if (doc.phone && !/^\+?[0-9]{10,15}$/.test(String(doc.phone))) {
    errors.push({ row: 0, field: 'phone', message: 'Invalid phone format', severity: 'warning' })
  }
  if (doc.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(doc.email))) {
    errors.push({ row: 0, field: 'email', message: 'Invalid email format', severity: 'warning' })
  }
  return errors
}

function validateGlAccounts(doc: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []
  if (!doc.name || String(doc.name).trim() === '') {
    errors.push({ row: 0, field: 'name', message: 'Account name is required', severity: 'error' })
  }
  if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(String(doc.type || ''))) {
    errors.push({ row: 0, field: 'type', message: 'Invalid account type', severity: 'error' })
  }
  return errors
}

/* ── The registry ─────────────────────────────────────────────────────── */

const REGISTRY: EntityExcelConfig[] = [
  {
    slug: 'fiscal-years',
    sheetName: 'Fiscal Years',
    label: 'Fiscal Years',
    kind: 'master',
    importOrder: 10,
    columns: [
      col('label', 'Label', 12),
      col('startDate', 'Start Date (AD)', 16),
      col('endDate', 'End Date (AD)', 16),
      col('status', 'Status', 10),
      col('isActive', 'Working Year', 14),
    ],
    dedupKeys: keys('label'),
    booleanFields: ['isActive'],
    example: {
      label: '2083-84',
      startDate: '2026-07-16',
      endDate: '2027-07-15',
      status: 'active',
      isActive: true,
    },
  },
  {
    slug: 'account-groups',
    sheetName: 'Account Groups',
    label: 'Account Groups',
    kind: 'master',
    importOrder: 20,
    columns: [
      col('code', 'Code', 12),
      col('name', 'Name', 30),
      col('type', 'Type', 14),
      col('parent', 'Parent Group', 24),
      col('description', 'Description', 40),
      col('sortOrder', 'Sort Order', 12),
    ],
    dedupKeys: keys('name'),
    fkLinks: [{ field: 'parent', refSlug: 'account-groups', refField: 'name' }],
    validate: requireField('name', 'Group name is required'),
    example: { code: 'CA', name: 'Current Assets', type: 'asset', parent: '', description: 'Example — delete me', sortOrder: 1 },
  },
  {
    slug: 'gl-accounts',
    sheetName: 'Chart of Accounts',
    label: 'Chart of Accounts',
    kind: 'master',
    importOrder: 30,
    columns: [
      col('code', 'Code', 12),
      col('name', 'Name', 34),
      col('type', 'Type', 14),
      col('class', 'Class', 10),
      col('group', 'Group', 24),
      col('openingBalance', 'Opening Balance', 18),
      col('active', 'Active', 10),
    ],
    dedupKeys: keys('code', 'name'),
    fkLinks: [{ field: 'group', refSlug: 'account-groups', refField: 'name' }],
    isHierarchical: true,
    validate: validateGlAccounts,
    booleanFields: ['active'],
    example: { code: '1000', name: 'Cash in Hand', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 50000, active: true },
  },
  {
    slug: 'tax-types',
    sheetName: 'Tax Types',
    label: 'Tax Types',
    kind: 'master',
    importOrder: 40,
    columns: [
      col('code', 'Code', 10),
      col('name', 'Name', 24),
      col('nature', 'Nature', 12),
      col('rate', 'Rate (%)', 10),
      col('active', 'Active', 10),
    ],
    dedupKeys: keys('code'),
    validate: requireField('name', 'Tax type name is required'),
    booleanFields: ['active'],
    example: { code: 'VAT13', name: 'Output VAT 13%', nature: 'additive', rate: 13, active: true },
  },
  {
    slug: 'membership-types',
    sheetName: 'Membership Types',
    label: 'Membership Types',
    kind: 'master',
    importOrder: 50,
    columns: [
      col('name', 'Name', 24),
      col('fee', 'Fee (NPR)', 14),
      col('periodMonths', 'Period (Months)', 16),
      col('description', 'Description', 36),
      col('active', 'Active', 10),
    ],
    dedupKeys: keys('name'),
    validate: requireField('name', 'Membership type name is required'),
    booleanFields: ['active'],
    example: { name: 'Annual Member', fee: 1000, periodMonths: 12, description: 'Example — delete me', active: true },
  },
  {
    slug: 'members',
    sheetName: 'Members',
    label: 'Members',
    kind: 'master',
    importOrder: 60,
    columns: [
      col('memberId', 'Member ID', 14),
      col('fullName', 'Full Name', 30),
      col('email', 'Email', 30),
      src('phone', 'Phone', 18, 'phoneNumber'),
      src('bloodGroup', 'Blood Group', 14, 'idCardDetails.bloodGroup'),
      col('membershipType', 'Membership Type', 22),
      src('appliedDateBs', 'Applied Date (BS)', 18, 'application.appliedDateBs'),
      col('status', 'Status', 12),
      col('joinedDate', 'Joined Date (AD)', 18),
    ],
    dedupKeys: keys('memberId', 'phone', 'email', 'fullName'),
    fkLinks: [{ field: 'membershipType', refSlug: 'membership-types', refField: 'name' }],
    // Members UI/CSV use friendly names — map them to canonical fields here
    // instead of in the generic header normalizer (which must stay
    // collection-agnostic so parties/items round-trip `name` → `name`).
    headerAliases: { name: 'fullName', mobile: 'phone', नाम: 'fullName' },
    validate: validateMembers,
    // Canonical (friendly) fields → payload shape: phone lives at
    // phoneNumber, bloodGroup / appliedDateBs are nested groups.
    mapForApi: (doc) => {
      const out: Record<string, unknown> = { ...doc }
      // role is a Payload select: admin | moderator | member | vip.
      const validRoles = ['admin', 'moderator', 'member', 'vip']
      if (!out.role || !validRoles.includes(String(out.role))) {
        out.role = 'member'
      }
      if (!out.email && out.fullName) {
        const slug = String(out.fullName)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.|\.$/g, '')
        out.email = `${slug}@syasyahsamaj.com`
      }
      if ('phone' in out) {
        out.phoneNumber = out.phone
        delete out.phone
      }
      const blood = out.bloodGroup
      delete out.bloodGroup
      if (blood !== undefined && blood !== '') {
        out.idCardDetails = {
          ...((out.idCardDetails as Record<string, unknown>) || {}),
          bloodGroup: blood,
        }
      }
      const applied = out.appliedDateBs
      delete out.appliedDateBs
      if (applied !== undefined && applied !== '') {
        out.application = {
          ...((out.application as Record<string, unknown>) || {}),
          appliedDateBs: applied,
        }
      }
      if (out.membershipType === '') out.membershipType = null
      return out
    },
    example: {
      memberId: 'M-001',
      fullName: 'Example Member (delete me)',
      email: 'member@example.com',
      phone: '9841000001',
      bloodGroup: 'O+',
      membershipType: 'Annual Member',
      appliedDateBs: '2083-01-15',
      status: 'active',
      joinedDate: '2026-04-01',
    },
  },
  {
    slug: 'parties',
    sheetName: 'Parties',
    label: 'Parties / Vendors',
    kind: 'master',
    importOrder: 70,
    columns: [
      col('type', 'Type', 12),
      col('name', 'Name', 30),
      col('email', 'Email', 28),
      col('phone', 'Phone', 18),
      col('taxId', 'PAN / Tax ID', 18),
      col('address', 'Address', 40),
      col('openingBalance', 'Opening Balance', 18),
      col('donor', 'Donor', 10),
    ],
    dedupKeys: keys('name', 'phone', 'taxId'),
    validate: requireField('name', 'Party name is required'),
    booleanFields: ['donor'],
    example: { type: 'customer', name: 'Example Party (delete me)', email: 'party@example.com', phone: '9841000002', taxId: '300000000', address: 'Kathmandu', openingBalance: 0, donor: false },
  },
  {
    slug: 'items',
    sheetName: 'Items',
    label: 'Items / Inventory',
    kind: 'master',
    importOrder: 80,
    columns: [
      col('code', 'Code', 12),
      col('name', 'Name', 30),
      col('unit', 'Unit', 10),
      col('valuationMethod', 'Valuation', 16),
      col('reorderLevel', 'Reorder Level', 16),
      col('openingStock', 'Opening Stock', 16),
      col('salePrice', 'Sale Price', 14),
      col('purchasePrice', 'Purchase Price', 16),
      col('active', 'Active', 10),
    ],
    dedupKeys: keys('code', 'name'),
    validate: requireField('name', 'Item name is required'),
    booleanFields: ['active'],
    example: { code: 'ITM-001', name: 'Example Item (delete me)', unit: 'pcs', valuationMethod: 'avco', reorderLevel: 10, openingStock: 100, salePrice: 150, purchasePrice: 100, active: true },
  },
  {
    slug: 'fixed-assets',
    sheetName: 'Fixed Assets',
    label: 'Fixed Assets',
    kind: 'master',
    importOrder: 85,
    columns: [
      col('code', 'Asset Code', 14),
      col('name', 'Asset Name', 30),
      col('category', 'Category', 14),
      col('purchaseDate', 'Purchase Date', 16),
      col('purchaseCost', 'Purchase Cost', 16),
      col('salvageValue', 'Salvage Value', 16),
      col('usefulLifeYears', 'Useful Life (Yrs)', 18),
      col('location', 'Location', 20),
      col('status', 'Status', 10),
    ],
    dedupKeys: keys('code'),
    validate: requireField('name', 'Asset name is required'),
    example: { code: 'FA-001', name: 'Example Asset (delete me)', category: 'equipment', purchaseDate: '2026-04-01', purchaseCost: 50000, salvageValue: 5000, usefulLifeYears: 5, location: 'Hall A', status: 'active' },
  },
  {
    slug: 'opening-balances',
    sheetName: 'Opening Balances',
    label: 'Opening Balances',
    kind: 'master',
    importOrder: 90,
    columns: [
      col('accountCode', 'Account Code', 16),
      col('accountName', 'Account Name', 30),
      col('fiscalYear', 'Fiscal Year', 14),
      col('amount', 'Amount', 16),
    ],
    // NOTE: ideal key is accountCode+fiscalYear (composite) — classifyRecords
    // matches keys independently, so accountCode alone can cross FYs. Upgrade
    // to composite matching in M3 when the import pipeline is wired.
    dedupKeys: keys('accountCode'),
    fkLinks: [
      { field: 'accountCode', refSlug: 'gl-accounts', refField: 'code', to: 'account' },
      { field: 'fiscalYear', refSlug: 'fiscal-years', refField: 'label' },
    ],
    validate: requireField('accountCode', 'Account code is required'),
    example: { accountCode: '1000', accountName: 'Cash in Hand', fiscalYear: '2083-84', amount: 50000 },
  },
  {
    slug: 'documents',
    sheetName: 'Vouchers',
    label: 'Vouchers',
    kind: 'transaction',
    importOrder: 100,
    columns: [
      col('number', 'Voucher No', 22),
      col('docType', 'Doc Type', 24),
      col('date', 'Date', 14),
      col('party', 'Party', 30),
      col('narration', 'Narration', 50),
      col('status', 'Status', 10),
    ],
    dedupKeys: keys('number'),
    fkLinks: [{ field: 'party', refSlug: 'parties', refField: 'name' }],
    validate: requireField('docType', 'Doc type is required'),
    booleanFields: [],
    example: { number: 'SI-2083-84-0001', docType: 'sales-invoice', date: '2026-04-01', party: 'Example Party (delete me)', narration: 'Example invoice — delete me', status: 'draft' },
  },
  {
    slug: 'journal-entries',
    sheetName: 'Journal Entries',
    label: 'Journal Entries',
    kind: 'transaction',
    importOrder: 110,
    // Flattened: one row per journal line; header fields repeat per line.
    columns: [
      col('date', 'Date', 14),
      col('voucherNo', 'Voucher No', 22),
      col('narration', 'Narration', 50),
      col('status', 'Status', 10),
      col('accountCode', 'Account Code', 16),
      col('accountName', 'Account Name', 30),
      col('debit', 'Debit', 14),
      col('credit', 'Credit', 14),
      col('memo', 'Line Memo', 40),
    ],
    // No business key — a journal line is identified by its DB id only.
    dedupKeys: [],
    // Flattened rows sharing a voucherNo become ONE journal-entries doc.
    groupBy: 'voucherNo',
    // One API doc (a voucher with lines[]) expands to one row per line.
    // Docs already flattened (no lines[]) pass through unchanged.
    expand: (doc) => {
      if (!Array.isArray(doc.lines)) return [doc]
      const ref = doc.referenceDoc
      const voucherNo =
        ref && typeof ref === 'object' ? (ref as { number?: string }).number : ref
      const lines = Array.isArray(doc.lines) ? (doc.lines as Record<string, unknown>[]) : []
      const base = {
        date: doc.date,
        voucherNo: voucherNo ?? '',
        narration: doc.narration ?? '',
        status: doc.status ?? '',
      }
      return lines.map((line) => {
        const acc =
          line.account && typeof line.account === 'object'
            ? (line.account as { code?: string; name?: string })
            : null
        return {
          ...base,
          accountCode: acc ? (acc.code ?? '') : (line.account ?? ''),
          accountName: acc ? (acc.name ?? '') : '',
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          memo: line.memo ?? '',
        }
      })
    },
    example: {
      date: '2026-04-01',
      voucherNo: 'JV-2083-84-0001',
      narration: 'Example journal — delete me',
      status: 'posted',
      accountCode: '1000',
      accountName: 'Cash in Hand',
      debit: 500,
      credit: 0,
      memo: '',
    },
    fkLinks: [
      { field: 'voucherNo', refSlug: 'documents', refField: 'number', to: 'referenceDoc' },
      { field: 'accountCode', refSlug: 'gl-accounts', refField: 'code' },
    ],
    // Grouped doc → payload: regroup `_rows` into lines[], account codes
    // resolved per line (voucherNo already resolved to referenceDoc by
    // resolveFks via the fkLinks above).
    mapForApi: (doc, ctx) => {
      const rows = (Array.isArray(doc._rows) ? doc._rows : []) as Record<string, unknown>[]
      const lines = rows.map((r) => {
        const account = ctx.findId('gl-accounts', 'code', r.accountCode)
        if (account === undefined) {
          ctx.missing('gl-accounts', 'accountCode', r.accountCode ?? '')
        }
        return {
          account: account ?? null,
          debit:
            r.debit === null || r.debit === undefined || r.debit === ''
              ? null
              : Number(r.debit),
          credit:
            r.credit === null || r.credit === undefined || r.credit === ''
              ? null
              : Number(r.credit),
          memo: r.memo ?? '',
        }
      })
      return {
        date: doc.date,
        narration: doc.narration ?? '',
        status: doc.status || 'draft',
        referenceDoc: doc.referenceDoc ?? null,
        lines,
      }
    },
    validate: (doc) =>
      Number(doc.debit || 0) === 0 && Number(doc.credit || 0) === 0
        ? [{ row: 0, field: 'debit', message: 'Line has neither debit nor credit', severity: 'error' }]
        : [],
  },
  {
    slug: 'stock-movements',
    sheetName: 'Stock Movements',
    label: 'Stock Movements',
    kind: 'transaction',
    importOrder: 120,
    columns: [
      col('itemCode', 'Item Code', 14),
      col('date', 'Date', 14),
      col('qtyIn', 'Qty In', 10),
      col('qtyOut', 'Qty Out', 10),
      col('unitCost', 'Unit Cost', 12),
      col('location', 'Location', 16),
    ],
    // Movements have no natural business key (same item moves daily).
    dedupKeys: [],
    fkLinks: [{ field: 'itemCode', refSlug: 'items', refField: 'code', to: 'item' }],
    example: { itemCode: 'ITM-001', date: '2026-04-01', qtyIn: 10, qtyOut: 0, unitCost: 100, location: 'Store' },
  },
  {
    slug: 'bank-statements',
    sheetName: 'Bank Statements',
    label: 'Bank Statements',
    kind: 'transaction',
    importOrder: 130,
    columns: [
      col('accountCode', 'Account Code', 16),
      col('periodStart', 'Period Start', 16),
      col('periodEnd', 'Period End', 16),
      col('openingBalance', 'Opening Balance', 18),
      col('closingBalance', 'Closing Balance', 18),
      // Nested statement lines round-trip as a JSON array string (rows[]).
      col('rows', 'Rows (JSON)', 60),
    ],
    dedupKeys: [],
    fkLinks: [{ field: 'accountCode', refSlug: 'gl-accounts', refField: 'code', to: 'account' }],
    example: {
      accountCode: '1010',
      periodStart: '2083-04-01',
      periodEnd: '2083-04-30',
      openingBalance: 100000,
      closingBalance: 115500,
      rows: '[{"date":"2083-04-05","amount":1500,"description":"Deposit"}]',
    },
  },
  {
    slug: 'expense-claims',
    sheetName: 'Expense Claims',
    label: 'Expense Claims',
    kind: 'transaction',
    importOrder: 140,
    columns: [
      col('claimNumber', 'Claim No', 16),
      col('claimant', 'Claimant', 24),
      col('date', 'Date', 14),
      col('status', 'Status', 12),
      col('lines', 'Lines (JSON)', 60),
      col('totalAmount', 'Total Amount', 16),
      col('billable', 'Billable', 10),
    ],
    dedupKeys: keys('claimNumber'),
    validate: requireField('claimNumber', 'Claim number is required'),
    booleanFields: ['billable'],
    example: {
      claimNumber: 'EC-001',
      claimant: 'Example Person (delete me)',
      date: '2026-04-01',
      status: 'draft',
      lines: '[{"description":"Taxi fare","amount":500}]',
      totalAmount: 500,
      billable: false,
    },
  },
  {
    slug: 'recurring-schedules',
    sheetName: 'Recurring Schedules',
    label: 'Recurring Billing',
    kind: 'transaction',
    importOrder: 150,
    columns: [
      col('name', 'Schedule Name', 28),
      col('docType', 'Doc Type', 24),
      col('frequency', 'Frequency', 14),
      col('dayOfMonth', 'Day of Month', 14),
      col('party', 'Party', 30),
      col('taxRate', 'Tax Rate (%)', 14),
      col('narration', 'Narration', 40),
      col('startDate', 'Start Date', 14),
      col('endDate', 'End Date', 14),
      col('nextRunDate', 'Next Run', 14),
      col('status', 'Status', 12),
      col('lines', 'Lines (JSON)', 60),
    ],
    dedupKeys: keys('name'),
    fkLinks: [{ field: 'party', refSlug: 'parties', refField: 'name' }],
    validate: requireField('name', 'Schedule name is required'),
    example: {
      name: 'Example monthly billing (delete me)',
      docType: 'sales-invoice',
      frequency: 'monthly',
      dayOfMonth: 1,
      party: 'Example Party (delete me)',
      taxRate: 13,
      narration: 'Monthly subscription',
      startDate: '2083-04-01',
      endDate: '',
      nextRunDate: '2083-05-01',
      status: 'active',
      lines: '[{"description":"Monthly fee","qty":1,"rate":1000}]',
    },
  },
]

export interface EntityRegistry extends Array<EntityExcelConfig> {
  get(slug: string): EntityExcelConfig | undefined
}

export const ENTITY_REGISTRY = REGISTRY as EntityRegistry
ENTITY_REGISTRY.get = (slug: string) => ENTITY_REGISTRY.find((e) => e.slug === slug)
