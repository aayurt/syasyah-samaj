import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const Timeline: CollectionConfig = {
  slug: 'timeline',
  access: {
    create: authenticated,
    delete: authenticated,
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Content',
    useAsTitle: 'year',
  },
  fields: [
    {
      name: 'year',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'adYear',
      type: 'number',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      localized: true,
    },
    {
      name: 'tag',
      type: 'text',
      localized: true,
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}