// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { resendAdapter } from '@payloadcms/email-resend'
import { Events } from './collections/Events'
import { Orders } from './collections/Orders'
import { Tickets } from './collections/Tickets'
import { Tenants } from './collections/Tenants'
import { Notifications } from './collections/Notifications'
import { Favorites } from './collections/Favorites'
import { trustedOriginsValues } from './trustedOrigin'
import Redis from 'ioredis'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
})
export default buildConfig({
  admin: {
    // components: {
    //   // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
    //   // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
    //   beforeLogin: ['@/components/BeforeLogin'],
    //   // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
    //   // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
    //   beforeDashboard: ['@/components/BeforeDashboard'],
    // },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  email: resendAdapter({
    apiKey: process.env.RESEND_API_KEY || '',
    defaultFromAddress: 'noreply@afnoevents.co.uk',
    defaultFromName: 'Afno',
  }),
  collections: [
    Pages,
    Posts,
    Media,
    Categories,
    Users,
    Events,
    Orders,
    Tickets,
    Tenants,
    Notifications,
    Favorites,
  ],
  cors: [getServerSideURL(), ...trustedOriginsValues].filter(Boolean),
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    // storage-adapter-placeholder
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [],
  },
})
