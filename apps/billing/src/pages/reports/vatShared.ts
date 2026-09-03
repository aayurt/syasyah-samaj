import type { Document, Party, TaxLine } from '../../lib/types'

/**
 * Shared logic for the four VAT registers (Sales, Purchase, Sales Return,
 * Purchase Return). See docs/VAT_REGISTERS.md for the full spec.
 *
 * A register is a list of posted, VAT-bearing documents with taxable / VAT /
 * gross amounts. Returns render as negatives so sales + sales-return (and
 * purchase + purchase-return) reconcile to the net figures.
 */

export type VatRegisterMode =
  | 'sales'
  | 'purchase'
  | 'sales-return'
  | 'purchase-return'

export const VAT_MODES: VatRegisterMode[] = [
  'sales',
  'purchase',
  'sales-return',
  'purchase-return',
]

export function modeLabel(mode: VatRegisterMode): string {
  switch (mode) {
    case 'sales': return 'Sales Register'
    case 'purchase': return 'Purchase Register'
    case 'sales-return': return 'Sales Return Register'
    case 'purchase-return': return 'Purchase Return Register'
  }
}

export interface VatRow {
  docId: number
  date: string
  number: string | null
  partyName: string
  partyPan?: string
  narration?: string
  rate: number | null
  taxable: number
  vat: number
  total: number
  isReturn: boolean
}

/** Documents treated as purchase-side references for credit notes. */
const PURCHASE_REFS = new Set(['purchase-invoice', 'purchase-order', 'grn'])

/** True when a document belongs to a given register mode. */
export function docMatchesMode(
  doc: Pick<Document, 'docType' | 'status' | 'referenceToDocType'>,
  mode: VatRegisterMode,
): boolean {
  if (doc.status !== 'posted') return false
  switch (mode) {
    case 'sales':
      return doc.docType === 'sales-invoice'
    case 'purchase':
      return doc.docType === 'purchase-invoice'
    case 'sales-return':
      return (
        doc.docType === 'credit-note' &&
        !PURCHASE_REFS.has(doc.referenceToDocType ?? '')
      )
    case 'purchase-return':
      return (
        doc.docType === 'credit-note' &&
        PURCHASE_REFS.has(doc.referenceToDocType ?? '')
      )
  }
}

/** Whether the document carries a VAT (non-withholding) tax line. */
export function hasVatTax(doc: Pick<Document, 'taxLines' | 'taxRate' | 'taxTotal'>): boolean {
  if (doc.taxLines?.length) {
    return doc.taxLines.some((tl: TaxLine) => tl.nature !== 'withholding')
  }
  return Number(doc.taxRate || 0) > 0 || Number(doc.taxTotal || 0) > 0
}

/** Effective VAT-bearing amount of a document (gross minus voided). */
export function effectiveAmountOf(doc: Document): number {
  return (Number(doc.grossTotal) || 0) - (Number(doc.voidedAmount) || 0)
}

/** The single VAT rate for a doc (null when mixed / unspecified). */
export function docRate(doc: Document): number | null {
  const tls = (doc.taxLines || []).filter((tl) => tl.nature !== 'withholding')
  if (tls.length === 1) {
    const r = Number(tls[0].rate)
    if (r > 0) return r
  }
  const r = Number(doc.taxRate || 0)
  return r > 0 ? r : null
}

/**
 * Build register rows from fetched documents.
 *
 * Amount mapping: taxable = netTotal, VAT = taxTotal, total = grossTotal
 * (netTotal already excludes inclusive tax; totals are pre-computed by the
 * posting engine). Rows dated inside the range are the caller's concern —
 * the where clause filters server-side already, but `docs` may include
 * outside-range rows when reading from the offline cache, so callers should
 * pass already-range-filtered docs or filter with `dateRangeFilter`.
 */
export function buildRegisterRows(
  docs: Document[],
  mode: VatRegisterMode,
  partyMap: Map<number | string, Party>,
): VatRow[] {
  const isReturn = mode === 'sales-return' || mode === 'purchase-return'
  const rows: VatRow[] = []
  for (const doc of docs) {
    if (!docMatchesMode(doc, mode)) continue
    const party =
      doc.party && typeof doc.party === 'object'
        ? (doc.party as Party)
        : partyMap.get(Number(doc.party ?? -1))
    const total = effectiveAmountOf(doc)
    if (total <= 0 && !isReturn) continue // nothing to register
    rows.push({
      docId: doc.id,
      date: doc.date || '',
      number: doc.number || null,
      partyName: party?.name || '—',
      partyPan: party?.taxId || undefined,
      narration: doc.narration || undefined,
      rate: docRate(doc),
      taxable: Number(doc.netTotal) || 0,
      vat: Number(doc.taxTotal) || 0,
      total,
      isReturn,
    })
  }
  // Registers are date-ordered.
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.docId - b.docId))
  return rows
}

/** Returns signed amounts for display: returns are negative. */
export function signed(row: VatRow): { taxable: number; vat: number; total: number } {
  if (!row.isReturn) {
    return { taxable: row.taxable, vat: row.vat, total: row.total }
  }
  return { taxable: -row.taxable, vat: -row.vat, total: -row.total }
}
