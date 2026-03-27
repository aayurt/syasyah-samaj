import { isAdmin } from '@/access/admin'
import { sendFCMTopicNotification } from '@/utilities/sendFCMNotification'
import { getCachedEvents, invalidateEventsCache } from '@/utilities/cache'
import type { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { Banner } from '../../blocks/Banner/config'
import { Code } from '../../blocks/Code/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  defaultPopulate: {
    title: true,
    slug: true,
    meta: {
      image: true,
      description: true,
    },
  },
  admin: {
    useAsTitle: 'title',
    group: 'Events',
  },
  endpoints: [
    {
      path: '/cached',
      method: 'get',
      handler: async (req) => {
        try {
          const events = await getCachedEvents(req.payload)
          return Response.json(events)
        } catch (error) {
          req.payload.logger.error(`Error in /events/cached: ${error}`)
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && req?.payload) {
          // Invalidate cache
          await invalidateEventsCache(doc.id)

          const users = await req.payload.find({
            collection: 'users',
            limit: 1000,
          })
          users.docs.forEach((user) => {
            req.payload.create({
              collection: 'notifications',
              data: {
                user: user.id,
                title: 'Check out for ' + doc.title + ' event.',
                message: doc.description || 'Check out the ' + doc.title + ' event.',
                type: 'event',
                link: `/events/${doc.slug}`,
              },
            })
          })
          await sendFCMTopicNotification({
            topic: 'afno-app-event',
            notification: {
              title: 'Check out for ' + doc.title + ' event.',
              body: doc.description || 'Check out the ' + doc.title + ' event.',
              imageUrl: doc.coverImage?.url,
              id: doc.id,
            },
          })
        }
        return doc
      },
    ],
    afterDelete: [
      async ({ id }) => {
        await invalidateEventsCache(id)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      required: false,
      type: 'textarea',
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
            HorizontalRuleFeature(),
          ]
        },
      }),
      label: false,
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      // required: true,
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
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'location',
          type: 'text',
          required: false,
          admin: {
            description: 'Location of the event location',
          },
        },
        {
          name: 'Map location',
          type: 'text',
          required: false,
          admin: {
            description: 'Map address of the event location for google maps',
          },
        },
        {
          name: 'latitude',
          type: 'number',
          required: false,
          admin: {
            description: 'Latitude coordinate of the event location',
            step: 0.000001,
          },
        },
        {
          name: 'longitude',
          type: 'number',
          required: false,
          admin: {
            description: 'Longitude coordinate of the event location',
            step: 0.000001,
          },
        },
      ],
      admin: {
        description: 'Event location coordinates',
      },
    },
    {
      name: 'startDatetime',
      type: 'date',
      required: false,
      defaultValue: new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MMM d, yyyy h:mm a',
        },
      },
    },
    {
      name: 'endDatetime',
      type: 'date',
      required: false,
      defaultValue: new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'MMM d, yyyy h:mm a',
        },
      },
    },

    {
      name: 'relatedEvents',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      filterOptions: ({ id }) => {
        return {
          id: {
            not_in: [id],
          },
        }
      },
      hasMany: true,
      relationTo: 'events',
    },

    {
      name: 'tags',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Music', value: 'music' },
        { label: 'Gaming', value: 'gaming' },
        { label: 'Theatre', value: 'theatre' },
        { label: 'Arts', value: 'arts' },
        { label: 'Business', value: 'business' },
        { label: 'Technology', value: 'technology' },
        { label: 'Sports', value: 'sports' },
        { label: 'Food & Drink', value: 'food-drink' },
        { label: 'Exhibition', value: 'exhibition' },
        { label: 'Comedy', value: 'comedy' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Fitness', value: 'fitness' },
      ],
      admin: {
        description: 'Select one or more tags for this event',
        position: 'sidebar',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Enable or disable this event',
        position: 'sidebar',
      },
    },
    ...slugField(),

  ],
}
