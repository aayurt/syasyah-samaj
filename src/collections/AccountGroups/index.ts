import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

export const accountTypeOptions = [
  { label: 'Asset', value: 'asset' },
  { label: 'Liability', value: 'liability' },
  { label: 'Equity', value: 'equity' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
]

export const AccountGroups: CollectionConfig = {
  slug: 'account-groups',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'type', 'parent'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: accountTypeOptions,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'account-groups',
    },
    // Optional ilaka scoping — metadata only in v1, not enforced.
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    },
  ],
}
