import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'

export const Parties: CollectionConfig = {
  slug: 'parties',
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['name', 'type', 'email', 'phone', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
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
    // Optional per-party control accounts. When set, postings for this party
    // use these GL accounts instead of the global AR/AP defaults from
    // Billing Settings → Default accounts.
    {
      name: 'receivableAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        description: 'Optional AR control account for this party (overrides the global default).',
        position: 'sidebar',
      },
    },
    {
      name: 'payableAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: {
        description: 'Optional AP control account for this party (overrides the global default).',
        position: 'sidebar',
      },
    },
    {
      name: 'donor',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Mark as a donor to surface this party in donation reports.',
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
  hooks: {
    beforeValidate: [
      assignTenant,
      // Conditional mandatory: customer→AR, vendor→AP, both→both.
      // Non-zero opening balance requires the matching control account(s).
      async ({ data, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data
        if (!data) return data
        const d = data as Record<string, unknown>
        const errors: string[] = []
        const type = d.type as string | undefined
        const receivable = d.receivableAccount
        const payable = d.payableAccount
        const opening = Number(d.openingBalance || 0)
        const hasAR = !!receivable
        const hasAP = !!payable
        const needsAR = type === 'customer' || type === 'both' || opening !== 0
        const needsAP = type === 'vendor' || type === 'both' || opening !== 0
        if (needsAR && !hasAR) errors.push('receivableAccount: AR account is required for this party type / opening balance')
        if (needsAP && !hasAP) errors.push('payableAccount: AP account is required for this party type / opening balance')
        if (errors.length) throw new Error(errors.join('; '))
        return data
      },
    ],
  },
}
