export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type AccountClass = 'cash' | 'bank' | 'other'
export type EntryStatus = 'draft' | 'posted' | 'void'
export type DocumentStatus = 'draft' | 'posted' | 'void'

export type DocType =
  | 'sales-quote'
  | 'sales-invoice'
  | 'purchase-invoice'
  | 'payment-voucher'
  | 'receipt-voucher'
  | 'credit-note'
  | 'debit-note'
  | 'petty-cash-voucher'
  | 'grn'
  | 'delivery-challan'
  | 'journal-voucher'
  | 'contra'
  | 'membership-receipt'
  | 'donation-receipt'

export const DOC_TYPE_LABELS: Record<string, string> = {
  'sales-quote': 'Sales Quote',
  'sales-invoice': 'Sales Entry',
  'purchase-invoice': 'Purchase Entry',
  'payment-voucher': 'Payment Entry',
  'receipt-voucher': 'Receipt Entry',
  'credit-note': 'Credit Note',
  'debit-note': 'Debit Note',
  'petty-cash-voucher': 'Petty Cash Voucher',
  grn: 'Goods Received Note',
  'delivery-challan': 'Delivery Challan',
  'journal-voucher': 'Journal Entry',
  contra: 'Contra Entry',
  'membership-receipt': 'Membership Receipt',
  'donation-receipt': 'Donation Receipt',
}

export interface AccountGroup {
  id: number
  code?: string
  name: string
  type: AccountType
  parent?: number | AccountGroup | null
  tenant?: number | null
}

export interface Account {
  id: number
  code?: string
  name: string
  group?: number | AccountGroup | null
  type: AccountType
  class?: AccountClass
  openingBalance?: number
  active?: boolean
  allowManualPosting?: boolean
  tenant?: number | null
}

export interface JournalLine {
  id?: string
  account: number | string | null
  debit?: number
  credit?: number
  memo?: string
}

export type TaxNature = 'additive' | 'inclusive' | 'withholding'

export interface TaxType {
  id: number
  code: string
  name: string
  nature: TaxNature
  rate: number
  salesAccount?: number | Account | null
  purchaseAccount?: number | Account | null
  active?: boolean
  tenant?: number | null
}

export interface TaxLine {
  id?: string
  taxType: number | string | null
  nature: TaxNature
  rate: number
  baseAmount?: number
  amount?: number
}

export interface JournalEntry {
  id: number
  date: string
  narration?: string
  status: EntryStatus
  postedAt?: string
  lines: JournalLine[]
  tenant?: number | null
  updatedAt?: string
}

export interface TrialBalanceRow {
  account: { id: number; name: string; code: string; type: string }
  debit: number
  credit: number
  balance: number
}

export interface LedgerRow {
  id: number
  date: string
  narration: string
  status: EntryStatus
  debit: number
  credit: number
  balance: number
  runningBalance: number
}

export interface Party {
  id: number
  type: 'customer' | 'vendor' | 'both'
  name: string
  email?: string
  phone?: string
  taxId?: string
  address?: string
  openingBalance?: number
  tenant?: number | null
}

export interface DocumentLine {
  id?: string
  item?: number | Item | null
  description: string
  qty?: number
  rate?: number
  amount?: number
}

export interface Document {
  id: number
  docType: DocType
  number?: string
  date: string
  createdAt?: string
  updatedAt?: string
  party?: number | Party | null
  narration?: string
  status: DocumentStatus
  postedAt?: string
  journalEntry?: number | null
  referenceTo?: number | null
  linkedInvoice?: number | null
  paymentMethod?: 'cash' | 'bank'
  bankAccount?: number | null
  fromAccount?: number | null
  toAccount?: number | null
  lines?: DocumentLine[]
  journalLines?: JournalLine[]
  taxRate?: number
  taxLines?: TaxLine[]
  netTotal?: number
  taxTotal?: number
  grossTotal?: number
  discountTotal?: number
  discountMode?: 'pct' | 'amt'
  discountValue?: number
  tenant?: number | null
  voidedItems?: Array<{
    itemIndex: number
    quantity: number
    reason?: string
    creditNoteId?: number | null
    noteNumber?: string
    voidedAt?: string
    voidedBy?: string
  }>
  voidedAmount?: number
}



/** Effective amount of a document after subtracting voided items.
 *  Used by reports so partially-voided invoices don't inflate totals. */
export function effectiveAmount(d: Document): number {
  return (Number(d.grossTotal) || 0) - (Number(d.voidedAmount) || 0)
}

/** Effective net amount (for tax reports that use netTotal). */
export function effectiveNet(d: Document): number {
  const base = Number(d.netTotal) || Number(d.grossTotal) || 0
  return base - (Number(d.voidedAmount) || 0)
}

export interface Item {
  id: number
  code?: string
  name: string
  unit?: string
  valuationMethod?: 'avco' | 'fifo'
  reorderLevel?: number
  openingStock?: number
  salePrice?: number
  purchasePrice?: number
  active?: boolean
  tenant?: number | null
}

export interface StockMovement {
  id: number
  item: number | Item
  doc?: number | null
  date: string
  qtyIn?: number
  qtyOut?: number
  unitCost?: number
  location?: string
}

export interface StockLevel {
  item: { id: number; code?: string; name: string; unit?: string }
  onHand: number
  avgCost: number
  value: number
  belowReorder: boolean
}

export interface StockLedgerRow {
  id?: number | null
  date: string
  docId?: number | null
  docNumber?: string | null
  qtyIn: number
  qtyOut: number
  unitCost: number
  qtyOnHand: number
  avgCost: number
  balanceValue: number
  location?: string | null
}

export interface PnlRow {
  account: { id: number | null; code?: string; name: string }
  amount: number
}

export interface PnlResponse {
  income: PnlRow[]
  expense: PnlRow[]
  totals: { income: number; expense: number; netProfit: number }
}

export interface BsRow {
  account: { id: number | null; code?: string; name: string }
  balance: number
}

export interface BalanceSheetResponse {
  assets: BsRow[]
  liabilities: BsRow[]
  equity: BsRow[]
  totals: {
    assets: number
    liabilities: number
    equity: number
    liabilitiesEquity: number
  }
  balanced: boolean
}

export type DaybookType =
  | 'cash'
  | 'petty-cash'
  | 'sales'
  | 'purchase'
  | 'journal'
  | 'all'

export interface DaybookRow {
  id: number
  date: string
  narration: string
  accountName: string
  debit: number
  credit: number
  runningBalance?: number
  docId?: number | string | null
  docNumber?: string | null
  docType?: string | null
}

export interface DaybookResponse {
  type: DaybookType
  rows: DaybookRow[]
  totals: { debit: number; credit: number }
  closingBalance: number
}

export interface FiscalYear {
  id: number
  label?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: 'active' | 'closed' | null
  isActive?: boolean | null
  tenant?: number | { id: number } | null
}

export interface BillingSettings {
  calendarType?: 'AD' | 'BS'
  dateFormat?: string
  timeFormat?: '12h' | '24h'
  activeFiscalYear?: number | FiscalYear | null
  fiscalYearStart?: string
  freezeDate?: string
  receivableAccount?: number | Account | null
  payableAccount?: number | Account | null
  revenueAccount?: number | Account | null
  expenseAccount?: number | Account | null
  taxAccount?: number | Account | null
  cashAccount?: number | Account | null
  bankAccount?: number | Account | null
  pettyCashAccount?: number | Account | null
  inventoryAccount?: number | Account | null
  cogsAccount?: number | Account | null
  returnsAccount?: number | Account | null
  accruedPayableAccount?: number | Account | null
  depreciationAccount?: number | Account | null
  accumulatedDepreciationAccount?: number | Account | null
  bankReconciliationEnabled?: boolean
  simplifiedInvoiceEnabled?: boolean
  simplifiedInvoiceThreshold?: number
  membershipFeeAccount?: number | Account | null
  donationAccount?: number | Account | null
  companyName?: string
  companyPan?: string
  companyContact?: string
  companyEmail?: string
  companyAddress?: string
  companyLogo?: string
  defAccountOrder?: string[]
}

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'

export interface ExpenseClaim {
  id: number
  claimNumber: string
  claimant: string
  date: string
  status: ClaimStatus
  lines: Array<{
    id?: string
    description: string
    amount: number
    account?: number | Account | null
  }>
  totalAmount: number
  billable: boolean
  party?: number | Party | null
  billedInvoiceId?: number
  submittedAt?: string
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  reimbursedAt?: string
  journalEntry?: number
  paymentJournalEntry?: number
  tenant?: number | null
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type RecurringStatus = 'active' | 'paused' | 'completed'

export interface RecurringSchedule {
  id: number
  name: string
  docType: DocType
  frequency: RecurringFrequency
  dayOfMonth?: number
  party: number | Party | null
  lines: Array<{
    id?: string
    description: string
    qty?: number
    rate: number
    amount?: number
    item?: number | Item | null
  }>
  taxRate?: number
  narration?: string
  startDate: string
  endDate?: string
  nextRunDate: string
  lastRunDate?: string
  lastDocId?: number
  status: RecurringStatus
  generatedCount: number
  tenant?: number | null
}

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+'

export interface AgingRow {
  party: { id: number; name: string }
  docId: number
  docType: DocType
  number: string
  date: string
  amount: number
  days: number
  bucket: AgingBucket
}

export interface AgingParty {
  party: { id: number; name: string }
  total: number
  buckets: Record<AgingBucket, number>
}

export interface AgingResponse {
  side: 'ar' | 'ap'
  asOf: string
  rows: AgingRow[]
  parties: AgingParty[]
  totals: { total: number; buckets: Record<AgingBucket, number> }
}
