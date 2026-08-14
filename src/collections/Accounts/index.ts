import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'
import { accountTypeOptions } from '../AccountGroups'

export const Accounts: CollectionConfig = {
  // NB: slug 'accounts' is taken by the better-auth plugin's account collection.
  slug: 'gl-accounts',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['code', 'name', 'group', 'type', 'class', 'openingBalance', 'active'],
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
      name: 'group',
      type: 'relationship',
      relationTo: 'account-groups',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: accountTypeOptions,
    },
    {
      name: 'class',
      type: 'select',
      defaultValue: 'other',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Cash/bank accounts drive the cash & bank book and reconciliation.',
      },
    },
    {
      name: 'openingBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Opening balance at the start of the books (debit positive).',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'allowManualPosting',
      type: 'checkbox',
      defaultValue: true,
    },
    // Optional ilaka scoping — metadata only in v1, not enforced.
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    },
  ],
}
