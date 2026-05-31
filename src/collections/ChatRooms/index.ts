import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const ChatRooms: CollectionConfig = {
  slug: 'chat-rooms',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Messaging',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'direct',
      options: [
        { label: 'Direct Message', value: 'direct' },
        { label: 'Group Chat', value: 'group' },
      ],
      required: true,
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      required: true,
    },
  ],
}
