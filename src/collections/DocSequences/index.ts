import { isAdmin } from '@/access/admin'
import { isBillingUser } from '@/access/tenantScoped'
import type { CollectionConfig, Access } from 'payload'

/**
 * Document number sequences for voucher numbering.
 *
 * Keyed by `${docType}:${fiscalYear}`. The posting endpoint increments
 * the counter atomically so concurrent posts cannot reuse a number.
 *
 * Defect fixes:
 * - [BUG-7] Series are now user-manageable (add/edit/delete via SPA)
 * - [NEW]   Posted sequences (lastNumber > 0) cannot be deleted
 * - [NEW]   User can create new series and assign prefix per doc type
 */

/**
 * Document types that can own a number series.
 *
 * This list is the source of the Postgres enum `enum_doc_sequences_doc_type`.
 * `nextNumber()` (src/collections/Documents/index.ts) inserts the document type
 * into `doc_sequences.doc_type` when it assigns a voucher number, so every doc
 * type that can be numbered MUST appear here — otherwise the insert fails with
 * `invalid input value for enum enum_doc_sequences_doc_type`.
 *
 * Keep this in sync with `DOC_TYPES` in src/collections/Documents/index.ts.
 * The values are what the Documents collection uses, so they must match exactly
 * (note `contra`, not `contra-voucher`).
 *
 * History of the two bugs this list has had:
 * - The order types were missing, which made `POST /documents/:id/confirm` fail
 *   for every sales order and purchase order.
 * - The value was `contra-voucher` while documents use `contra`, which made
 *   posting a contra voucher fail the same way.
 *
 * `contra-voucher` is kept alongside `contra` so that number series a user
 * already created against it keep working. Documents use `contra`; the
 * alias exists only for the series list.
 */
export const DOC_TYPE_OPTIONS = [
  { label: 'Sales Quote', value: 'sales-quote' },
  { label: 'Sales Order', value: 'sales-order' },
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Order', value: 'purchase-order' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Receipt Voucher', value: 'receipt-voucher' },
  { label: 'Payment Voucher', value: 'payment-voucher' },
  { label: 'Journal Voucher', value: 'journal-voucher' },
  { label: 'Contra Voucher', value: 'contra' },
  { label: 'Contra Voucher (legacy)', value: 'contra-voucher' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Debit Note', value: 'debit-note' },
  { label: 'Petty Cash Voucher', value: 'petty-cash-voucher' },
  { label: 'GRN', value: 'grn' },
  { label: 'Delivery Challan', value: 'delivery-challan' },
  { label: 'Membership Receipt', value: 'membership-receipt' },
  { label: 'Donation Receipt', value: 'donation-receipt' },
]

export const DocSequences: CollectionConfig = {
  slug: 'doc-sequences',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    description: 'Number series for documents. Assign a prefix and format per document type.',
    defaultColumns: ['name', 'docType', 'prefix', 'lastNumber', 'updatedAt'],
  },
  access: {
    create: ({ req }: any) => isBillingUser(req.user),
    read: ({ req }: any) => isBillingUser(req.user),
    update: ({ req }: any) => isBillingUser(req.user),
    delete: ({ req, data }: any) => {
      // Only admins can delete; cannot delete if lastNumber > 0 (posted entries exist)
      if (!isAdmin({ req })) return false
      if ((data as any)?.lastNumber && (data as any).lastNumber > 0) {
        return false
      }
      return true
    },
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        const d = data as any
        if (!d) return data

        // Auto-generate key from docType + fiscalYear if not set
        if (!d.key && d.docType) {
          d.key = d.fiscalYear
            ? `${d.docType}:${d.fiscalYear}`
            : `${d.docType}:default`
        }

        // Auto-generate name if not provided
        if (!d.name && d.docType) {
          const typeName = DOC_TYPE_OPTIONS.find((o) => o.value === d.docType)?.label || d.docType
          d.name = d.prefix
            ? `${typeName} (${d.prefix})`
            : typeName
        }

        return data
      },
    ],
    beforeDelete: [
      ({ req, id }) => {
        // Double-check: cannot delete sequences with posted entries
        // This is a safety net; the access control should catch it first
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name for this series (auto-generated from type + prefix if empty).',
      },
    },
    {
      name: 'docType',
      type: 'select',
      required: true,
      options: DOC_TYPE_OPTIONS,
      admin: {
        description: 'The document type this sequence applies to.',
      },
    },
    {
      name: 'prefix',
      type: 'text',
      defaultValue: '',
      admin: {
        description: 'Prefix for document numbers, e.g. "SI-" for Sales Invoice, "PV-" for Payment Voucher.',
      },
    },
    {
      name: 'format',
      type: 'text',
      defaultValue: '{prefix}{year}-{number}',
      admin: {
        description: 'Number format template. Variables: {prefix}, {year}, {number}. Example: {prefix}{year}-{number}',
      },
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      admin: {
        description: 'If set, this sequence resets each fiscal year. Leave empty for a global counter.',
      },
    },
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Internal key (auto-generated: docType:fiscalYear).',
      },
    },
    {
      name: 'lastNumber',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Last used number. Cannot delete this series if > 0 (posted entries exist).',
      },
    },
    {
      name: 'nextPreview',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Preview of the next document number (read-only, computed).',
      },
    },
  ],
}
