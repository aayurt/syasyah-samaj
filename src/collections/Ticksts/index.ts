// collections/Tickets.ts
import crypto from 'crypto'
import { CollectionConfig } from 'payload'

export const Tickets: CollectionConfig = {
  slug: 'tickets',
  admin: {
    useAsTitle: 'code',
    group: 'Events',
  },

  hooks: {
    beforeValidate: [
      ({ data }) => {
        // generate secure token for QR
        if (!data) return data

        if (!data.code) {
          data.code = crypto.randomBytes(16).toString('hex')
        }
        return data
      },
    ],
  },

  fields: [
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      required: true,
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
    },

    // 🔥 this is what QR stores
    {
      name: 'code',
      type: 'text',
      unique: true,
      index: true,
    },

    {
      name: 'status',
      type: 'select',
      options: ['unused', 'checked-in', 'cancelled', 'refunded', 'transferred'],
      defaultValue: 'unused',
    },

    {
      name: 'checkedInAt',
      type: 'date',
    },

    // Optional attendee info
    {
      name: 'attendeeName',
      type: 'text',
    },
    {
      name: 'attendeeEmail',
      type: 'email',
    },
  ],
}
