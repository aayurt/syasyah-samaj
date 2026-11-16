import type { CollectionConfig } from 'payload'
import { scopedCreate, scopedDelete, scopedRead, scopedUpdate } from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import { validateOpeningBatch } from '@/utilities/accountingValidation'

export const OpeningBalanceLines: CollectionConfig = {
  slug: 'opening_balance_lines',
  access: {
    read: scopedRead,
    create: scopedCreate,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [assignTenant,
      async ({ data }: { data?: any }) => {
        if (!data) return
        const lines = Array.isArray(data.lines) ? data.lines : undefined
        if (!lines) return
        const result = validateOpeningBatch({
          lines: lines.map((l: any) => ({
            accountId: l.account,
            amount: (l.debit || 0) - (l.credit || 0),
            isPosting: true,
            isActive: true,
          })),
          fiscalYearStatus: 'open',
          postingAllowed: true,
        })
        if (!result.valid) {
          throw new Error(result.issues.map((i) => i.message).join('; '))
        }
      },
    ],
  },
  fields: [
    {
      name: 'batch',
      type: 'relationship',
      relationTo: 'opening_balance_batches',
      required: true,
      hasMany: false,
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'gl-accounts',
      required: true,
      hasMany: false,
    },
    {
      name: 'debit',
      type: 'number',
      defaultValue: 0,
      required: true,
      min: 0,
    },
    {
      name: 'credit',
      type: 'number',
      defaultValue: 0,
      required: true,
      min: 0,
    },
    {
      name: 'currency_code',
      type: 'text',
      defaultValue: 'NPR',
      required: true,
    },
    {
      name: 'exchange_rate',
      type: 'number',
    },
    {
      name: 'base_currency_amount',
      type: 'number',
    },
    {
      name: 'branch',
      type: 'text',
    },
    {
      name: 'cost_centre',
      type: 'text',
    },
    {
      name: 'reference',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
}
