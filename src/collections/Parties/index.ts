import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

export const Parties: CollectionConfig = {
  slug: 'parties',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['name', 'type', 'email', 'phone', 'updatedAt'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      options: [
        { label: 'Customer', value: 'customer' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Customer & Vendor', value: 'both' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'taxId',
      type: 'text',
      admin: {
        description: 'Tax registration / PAN number.',
      },
    },
    {
      name: 'address',
      type: 'textarea',
    },
    {
      name: 'openingBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Outstanding balance at the start of the books (positive = they owe you).',
        position: 'sidebar',
      },
    },
    // Optional ilaka scoping — metadata only in v1, not enforced.
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
