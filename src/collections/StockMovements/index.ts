import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'
import { toNum } from '@/utilities/journalValidation'

export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  admin: {
    useAsTitle: 'id',
    group: 'Billing',
    defaultColumns: ['date', 'item', 'doc', 'qtyIn', 'qtyOut', 'unitCost'],
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        const d = data as any
        const qtyIn = toNum(d.qtyIn)
        const qtyOut = toNum(d.qtyOut)
        if (qtyIn < 0 || qtyOut < 0) {
          throw new Error('Quantities cannot be negative.')
        }
        if (qtyIn > 0 && qtyOut > 0) {
          throw new Error('A stock movement is either in or out, not both.')
        }
        if (qtyIn === 0 && qtyOut === 0) {
          throw new Error('A stock movement needs a quantity.')
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'item',
      type: 'relationship',
      relationTo: 'items',
      required: true,
    },
    {
      name: 'doc',
      type: 'relationship',
      relationTo: 'documents',
      admin: {
        description: 'The voucher that caused this movement.',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
    },
    {
      name: 'qtyIn',
      type: 'number',
      admin: {
        description: 'Quantity received into stock.',
      },
    },
    {
      name: 'qtyOut',
      type: 'number',
      admin: {
        description: 'Quantity issued out of stock.',
      },
    },
    {
      name: 'unitCost',
      type: 'number',
      admin: {
        description: 'Unit cost at the time of the movement (AVCO).',
      },
    },
    {
      name: 'location',
      type: 'text',
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
