import type { CollectionConfig } from 'payload'

import { sendFCMTopicNotification } from '@/utilities/sendFCMNotification'
import { isAdmin } from '@/access/admin'
import { updateAndDeleteAccess } from './access/updateAndDelete'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: isAdmin,
    delete: updateAndDeleteAccess,
    read: () => true,
    update: updateAndDeleteAccess,
  },
  labels: {
    singular: 'Ilaka', // shows when editing a single tenant
    plural: 'Ilakas', // shows in the sidebar and collection list
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'domain'],
    group: 'Ilakas',
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin' || user.role === 'admin') return false
      return true
    },
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data?.name || !req?.payload) return data
        const name = typeof data.name === 'string' ? data.name.trim() : (data.name as any)?.en?.trim() || ''
        if (!name) return data

        const type = data.type || originalDoc?.type || 'illaka'
        const parent = data.parent !== undefined ? data.parent : originalDoc?.parent
        const isParent = type === 'central' || (!parent && type !== 'illaka')

        if (isParent) {
          const existing = await req.payload.find({
            collection: 'tenants',
            where: {
              type: { equals: 'central' },
            },
            limit: 100,
            depth: 0,
          })
          const currentId = originalDoc?.id
          const conflict = existing.docs.find((doc) => {
            if (currentId && String(doc.id) === String(currentId)) return false
            const docName = typeof doc.name === 'string' ? doc.name.trim() : (doc.name as any)?.en?.trim() || ''
            return docName.toLowerCase() === name.toLowerCase()
          })
          if (conflict) {
            throw new Error(`A parent company with the name "${name}" already exists. Parent company names must be unique.`)
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && req?.payload) {
          // The central C00 row is an accounting unit, not a website ilaka —
          // don't push a notification for it.
          if (doc.code === 'C00' || doc.type === 'central') return doc
          try {
            await sendFCMTopicNotification({
              topic: 'syasyah-samaj-ilaka',
              notification: {
                title: 'Keep an eye on ' + doc.name + ' events.',
                body: doc.description || 'Check out the ' + doc.name + ' events.',
                imageUrl: doc.coverImage?.url,
                id: doc.id,
                link: `/ilaka/${doc.slug}`,
              },
            })
          } catch {
            // FCM failure must not block tenant create/update.
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true
    },
    {
      name: 'code',
      type: 'text',
      required: false,
      unique: true,
      index: true,
      admin: {
        description:
          'Unique illaka code (e.g. IL01 … IL10). The central organization uses C00.',
        position: 'sidebar',
      },
    },
    {
      name: 'pan',
      type: 'text',
      required: false,
      admin: {
        description: 'Permanent Account Number (PAN) for the sub-company / branch.',
        position: 'sidebar',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'tenants',
      required: false,
      admin: {
        description:
          'Parent company for sub-companies / branches. Leave empty for root / parent companies.',
        position: 'sidebar',
      },
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'illaka',
      options: [
        { label: 'Central', value: 'central' },
        { label: 'Illaka', value: 'illaka' },
      ],
      admin: {
        description: 'Central is the parent organization (code C00); everything else is an illaka.',
        position: 'sidebar',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether the illaka is active for accounting.',
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'text',
      localized: true
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      required: false,
      admin: {
        description:
          'If checked, the tenant will be shown on the website. If not checked, the tenant will not be shown on the website.',
        position: 'sidebar',
      },
    },
    {
      name: 'contactInfo',
      type: 'group',
      fields: [
        {
          name: 'phone',
          type: 'text',
          // required: true,
        },
        {
          name: 'email',
          type: 'email',
          // required: true,
        },
      ],
    },

    {
      name: 'domain',
      type: 'text',
      admin: {
        description: 'Used for domain-based tenant handling',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      admin: {
        description: 'Used for url paths, example: /tenant-slug/page-slug',
        position: 'sidebar',
      },
      index: true,
      required: true,
    },
    {
      name: 'allowPublicRead',
      type: 'checkbox',
      admin: {
        description:
          'If checked, logging in is not required to read. Useful for building public pages.',
        position: 'sidebar',
      },
      defaultValue: false,
      index: true,
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'address',
          type: 'text',
          required: false,
          admin: {
            description: 'Physical address of the Ilaka',
          },
        },
        {
          name: 'mapUrl',
          type: 'text',
          required: false,
          admin: {
            description: 'Google Maps Embed URL or Link',
          },
        },
        {
          name: 'latitude',
          type: 'number',
          required: false,
          admin: {
            description: 'Latitude coordinate',
            step: 0.000001,
          },
        },
        {
          name: 'longitude',
          type: 'number',
          required: false,
          admin: {
            description: 'Longitude coordinate',
            step: 0.000001,
          },
        },
      ],
      admin: {
        description: 'Ilaka location details',
      },
    },
  ],
  // endpoints: [
  //   {
  //     path: '/by-slug/:slug',
  //     method: 'get',

  //     handler: async (req) => {
  //       const slug = req.routeParams?.slug as string

  //       const tenant = await req.payload.find({
  //         collection: 'tenants',
  //         where: {
  //           slug: {
  //             equals: slug,
  //           },
  //         },
  //         limit: 1,
  //       })
  //       if (!tenant.docs.length) {
  //         return Response.json({ message: 'Tenant not found' }, { status: 404 })
  //       }
  //       return Response.json(tenant.docs[0], { status: 200 })
  //     },
  //   },
  // ],
}
