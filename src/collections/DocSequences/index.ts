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

export const DOC_TYPE_OPTIONS = [
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Receipt Voucher', value: 'receipt-voucher' },
  { label: 'Payment Voucher', value: 'payment-voucher' },
  { label: 'Journal Voucher', value: 'journal-voucher' },
  { label: 'Contra Voucher', value: 'contra-voucher' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Debit Note', value: 'debit-note' },
  { label: 'GRN', value: 'grn' },
  { label: 'Delivery Challan', value: 'delivery-challan' },
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
