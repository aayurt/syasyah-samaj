import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { slugField } from '@/fields/slug'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { Banner } from '../blocks/Banner/config'
import { Code } from '../blocks/Code/config'
import { MediaBlock } from '../blocks/MediaBlock/config'

export const Archives: CollectionConfig = {
  slug: 'archives',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'era',
      type: 'text',
      localized: true,
      admin: {
        description: 'Historical era or period (e.g., 18th Century, Malla Era)',
      },
    },
    {
      name: 'year',
      type: 'number',
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
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
      required: true,
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'general',
      index: true,
      options: [
        {
          label: 'पाण्डुलिपि तथा तमसुक (Manuscript / Deed)',
          value: 'manuscript',
        },
        {
          label: 'ऐतिहासिक तस्बिर (Historical Photo)',
          value: 'photo',
        },
        {
          label: 'गुठी विधान (Guthi By-laws)',
          value: 'guthi',
        },
        {
          label: 'सामान्य अभिलेख (General Archive)',
          value: 'general',
        },
      ],
    },
    {
      name: 'documentFile',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'sourceOrLocation',
      type: 'text',
      localized: true,
    },
    ...slugField(),
  ],
}
