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
      // Auto-assign default AR/AP from billing-settings or Chart of Accounts if omitted.
      async ({ data, req, operation }) => {
        if (operation !== 'create' && operation !== 'update') return data
        if (!data) return data
        const d = data as Record<string, unknown>
        const type = d.type as string | undefined
        const opening = Number(d.openingBalance || 0)
        let receivable = d.receivableAccount
        let payable = d.payableAccount

        const needsAR = type === 'customer' || type === 'both' || opening !== 0
        const needsAP = type === 'vendor' || type === 'both' || opening !== 0

        // Auto-resolve default control accounts if not explicitly provided
        if (req?.payload) {
          const tenantId = d.tenant
          if (needsAR && !receivable) {
            try {
              const settings = await req.payload.findGlobal({ slug: 'billing-settings' as any, req })
              const defAR = settings?.receivableAccount
              if (defAR) {
                receivable = typeof defAR === 'object' ? (defAR as any).id : defAR
                d.receivableAccount = receivable
              } else {
                const found = await req.payload.find({
                  collection: 'gl-accounts',
                  where: {
                    and: [
                      { code: { in: ['1100', '1130', '1200'] } },
                      ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
                    ],
                  },
                  limit: 1,
                  req,
                })
                const firstAR = found.docs[0]
                if (firstAR) {
                  receivable = firstAR.id
                  d.receivableAccount = receivable
                }
              }
            } catch { }
          }

          if (needsAP && !payable) {
            try {
              const settings = await req.payload.findGlobal({ slug: 'billing-settings' as any, req })
              const defAP = settings?.payableAccount
              if (defAP) {
                payable = typeof defAP === 'object' ? (defAP as any).id : defAP
                d.payableAccount = payable
              } else {
                const found = await req.payload.find({
                  collection: 'gl-accounts',
                  where: {
                    and: [
                      { code: { in: ['2100', '2110', '2001', '3000'] } },
                      ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
                    ],
                  },
                  limit: 1,
                  req,
                })
                const firstAP = found.docs[0]
                if (firstAP) {
                  payable = firstAP.id
                  d.payableAccount = payable
                }
              }
            } catch { }
          }
        }

        const errors: string[] = []
        if (needsAR && !receivable) errors.push('receivableAccount: AR account is required for this party type / opening balance')
        if (needsAP && !payable) errors.push('payableAccount: AP account is required for this party type / opening balance')
        if (errors.length) throw new Error(errors.join('; '))
        return data
      },
    ],
  },
}
