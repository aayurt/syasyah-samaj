import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    create: () => true,
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'id',
    group: 'Events',
    defaultColumns: ['id', 'event', 'buyer', 'totalAmount', 'status'],
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin') return false
      return true
    },
  },
  fields: [
    {
      name: 'buyer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
    },

    { name: 'totalAmount', type: 'number' },

    {
      name: 'status',
      type: 'select',
      options: ['pending', 'paid', 'cancelled', 'refunded'],
      defaultValue: 'pending',
    },

    {
      name: 'tickets',
      type: 'relationship',
      relationTo: 'tickets',
      hasMany: true,
    },
  ],
}
