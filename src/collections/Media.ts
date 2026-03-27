import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import sharp from 'sharp'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  admin: {
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin') return false
      return true
    },
  },

  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'large',
        width: 1400,
      },
    ],
  },
  hooks: {
    beforeChange: [
      async ({ req, data }) => {
        const file = req.file;

        if (!file) return data;

        if (!file.mimetype.startsWith('image/')) return data;

        let buffer = file.data;

        // Skip if already under 1MB
        if (buffer.length <= 1024 * 1024) {
          return data;
        }

        let quality = 80;

        while (buffer.length > 1024 * 1024 && quality > 10) {
          buffer = await sharp(buffer)
            .jpeg({ quality })
            .toBuffer();

          quality -= 10;
        }

        // ✅ Assign back correctly
        file.data = buffer;
        file.mimetype = 'image/jpeg';
        file.name = file.name.replace(/\.\w+$/, '.jpg');
        file.size = buffer.length;

        return data;
      },
    ],
  },


}
