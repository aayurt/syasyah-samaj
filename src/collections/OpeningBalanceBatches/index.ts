import type { CollectionConfig } from 'payload'
import { scopedCreate, scopedDelete, scopedRead, scopedUpdate } from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'

export const OpeningBalanceBatches: CollectionConfig = {
  slug: 'opening_balance_batches',
  access: {
    read: scopedRead,
    create: scopedCreate,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [assignTenant],
  },
  fields: [
    {
      name: 'fiscal_year',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
      hasMany: false,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      hasMany: false,
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'approved', 'posted', 'rejected'],
      defaultValue: 'draft',
      required: true,
    },
    {
      name: 'total_debit',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'total_credit',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'reference',
      type: 'text',
    },
  ],
}
