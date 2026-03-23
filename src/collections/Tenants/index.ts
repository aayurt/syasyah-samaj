import type { CollectionConfig } from 'payload'

import { sendFCMTopicNotification } from '@/utilities/sendFCMNotification'
import { updateAndDeleteAccess } from './access/updateAndDelete'
import { isSuperAdminAccess } from '@/access/isSuperAdmin'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: isSuperAdminAccess,
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
    group: 'Ilakas',
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin') return false
      return true
    },
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && req?.payload) {
          await sendFCMTopicNotification({
            topic: 'afno-app-tenant',
            notification: {
              title: 'Keep an eye on ' + doc.name + ' events.',
              body: doc.description || 'Check out the ' + doc.name + ' events.',
              imageUrl: doc.coverImage?.url,
              id: doc.id,
            },
          })
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
