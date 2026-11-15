/**
 * Regression tests for the document-type enums.
 *
 * The bug this pins
 * -----------------
 * `nextNumber()` (src/collections/Documents/index.ts) assigns every voucher
 * number by inserting a row into `doc_sequences` with the document's type in
 * the `doc_type` column. That column is the Postgres enum generated from
 * `DOC_TYPE_OPTIONS` in src/collections/DocSequences/index.ts.
 *
 * `DOC_TYPE_OPTIONS` did not list 'sales-order' or 'purchase-order', so the
 * enum did not have those values and confirming any order failed with:
 *
 *   invalid input value for enum enum_doc_sequences_doc_type: "sales-order"
 *
 * The fix has two halves that must stay in sync:
 *   1. DOC_TYPE_OPTIONS must contain every type the Documents collection can
 *      number, and
 *   2. the migration must add the missing values to existing databases.
 *
 * Pure config, no database required.
 */
import { DOC_TYPE_OPTIONS, DocSequences } from '@/collections/DocSequences'

/** Document types the Documents collection supports. */
const DOCUMENT_TYPES = [
  'sales-quote',
  'sales-order',
  'sales-invoice',
  'purchase-order',
  'purchase-invoice',
  'payment-voucher',
  'receipt-voucher',
  'credit-note',
  'debit-note',
  'petty-cash-voucher',
  'grn',
  'delivery-challan',
  'journal-voucher',
  'contra',
  'membership-receipt',
  'donation-receipt',
]

/** The values the enum had before the 2026-11-15 fix. */
const PRE_FIX_ENUM_VALUES = [
  'sales-invoice',
  'purchase-invoice',
  'receipt-voucher',
  'payment-voucher',
  'journal-voucher',
  'contra-voucher',
  'credit-note',
  'debit-note',
  'grn',
  'delivery-challan',
]

const optionValues = DOC_TYPE_OPTIONS.map((o) => o.value)

describe('doc_sequences doc_type enum', () => {
  it('includes every document type that can be numbered', () => {
    // Every doc type in the Documents collection must be assignable a number
    // series, otherwise nextNumber() fails with an enum violation.
    const missing = DOCUMENT_TYPES.filter((t) => !optionValues.includes(t))
    expect(missing).toEqual([])
  })

  it('includes the order types that the p4_orders migration forgot', () => {
    expect(optionValues).toContain('sales-order')
    expect(optionValues).toContain('purchase-order')
  })

  it('keeps every value the pre-fix enum had, so no existing row breaks', () => {
    const missing = PRE_FIX_ENUM_VALUES.filter((v) => !optionValues.includes(v))
    expect(missing).toEqual([])
  })

  it('has no duplicate values', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const v of optionValues) {
      if (seen.has(v)) dupes.push(v)
      seen.add(v)
    }
    expect(dupes).toEqual([])
  })

  it('gives every option a human-readable label', () => {
    for (const o of DOC_TYPE_OPTIONS) {
      expect(typeof o.label).toBe('string')
      expect(o.label.length).toBeGreaterThan(0)
    }
  })

  it('wires DOC_TYPE_OPTIONS into the docType field of the collection', () => {
    const docTypeField = DocSequences.fields.find(
      (f) => (f as { name?: string }).name === 'docType',
    ) as { options?: unknown }
    expect(docTypeField).toBeDefined()
    expect(docTypeField.options).toBe(DOC_TYPE_OPTIONS)
  })
})
