import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'

export const TaxTypes: CollectionConfig = {
  slug: 'tax-types',
  labels: {
    singular: 'Tax Type',
    plural: 'Tax Types',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'nature', 'rate', 'active'],
    description:
      'Configurable taxes (VAT, GST, TDS…). The posting engine resolves each tax to its own sales/purchase ledger account.',
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [
      assignTenant,
      ({ data }) => {
        const d = data as any
        if (d.rate !== undefined && d.rate !== null && Number(d.rate) < 0) {
          throw new Error('Tax rate cannot be negative.')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Short code, e.g. VAT, GST-18, TDS-2.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name, e.g. Output VAT, Input TDS.',
      },
    },
    {
      name: 'nature',
      type: 'select',
      required: true,
      defaultValue: 'additive',
      options: [
        {
          label: 'Additive (added on top of the net total)',
          value: 'additive',
        },
        {
          label: 'Inclusive (included in the gross total)',
          value: 'inclusive',
        },
        {
          label: 'Withholding (deducted, e.g. TDS)',
          value: 'withholding',
        },
      ],
      admin: {
        position: 'sidebar',
        description:
          'additive = VAT/GST added to net; inclusive = baked into gross; withholding = TDS deducted from the payment.',
      },
    },
    {
      name: 'rate',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Percentage rate (0–100).',
      },
    },
    {
      name: 'salesAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        description:
          'Output tax / TDS receivable ledger (used when this tax applies to sales).',
      },
    },
    {
      name: 'purchaseAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        description:
          'Input tax / TDS payable ledger (used when this tax applies to purchases).',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}