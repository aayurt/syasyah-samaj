import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { searchFields } from '@/search/fieldOverrides'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { searchPlugin } from '@payloadcms/plugin-search'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { Plugin } from 'payload'

import { isAdmin } from '@/access/admin'
import { betterAuthOptions } from '@/lib/auth/config'
import { getBaseUrl } from '@/lib/auth/getBaseUrl'
import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import {
  betterAuthCollections,
  createBetterAuthPlugin,
  payloadAdapter,
} from '@delmaredigital/payload-better-auth'
import { betterAuth } from 'better-auth'
import { resend } from '@/lib/email/resend'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title
    ? `${doc.title} | ${process.env.NEXT_PUBLIC_APP_NAME}`
    : process.env.NEXT_PUBLIC_APP_NAME || 'Afno Event'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}
const baseUrl = getBaseUrl()

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
      access: {
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      access: {
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
    formSubmissionOverrides: {
      access: {
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),
  searchPlugin({
    collections: ['posts'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
      access: {
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
      },
    },
  }),
  payloadCloudPlugin(),
  betterAuthCollections({
    betterAuthOptions,
    skipCollections: ['user'], // We define Users ourselves
  }),
  // Initialize Better Auth with auto-injected endpoints and admin components
  createBetterAuthPlugin({
    createAuth: (payload) =>
      betterAuth({
        ...betterAuthOptions,
        database: payloadAdapter({
          payloadClient: payload,
          // adapterConfig: { enableDebugLogs: true }, // Uncomment to enable debug logging
        }),
        emailVerification: {
          sendVerificationEmail: async ({ user, url, token }, request) => {
            await resend.emails.send({
              from: `${process.env.NEXT_PUBLIC_APP_NAME} <onboarding@resend.dev>`,
              to: user.email,
              subject: 'Verify your email address',
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <title>Verify your email address</title>
                    <style>
                      body { font-family: sans-serif; line-height: 1.5; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; }
                      .footer { margin-top: 20px; font-size: 0.8em; color: #666; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h2>Verify your email address</h2>
                      <p>Hello ${user.name || 'there'},</p>
                      <p>Please click the button below to verify your email address:</p>
                      <p><a href="${url}" class="button">Verify Email</a></p>
                      <p>Or copy and paste this link into your browser:</p>
                      <p>${url}</p>
                      <div class="footer">
                        <p>If you didn't request this, you can safely ignore this email.</p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            })
          },
        },
        emailAndPassword: {
          enabled: true,
          sendResetPassword: async ({ user, url, token }, request) => {
            console.log({ user, url, token })
            await resend.emails.send({
              from: `${process.env.NEXT_PUBLIC_APP_NAME} <onboarding@resend.dev>`,
              to: user.email,
              subject: 'Reset your password',
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <title>Reset your password</title>
                    <style>
                      body { font-family: sans-serif; line-height: 1.5; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; }
                      .footer { margin-top: 20px; font-size: 0.8em; color: #666; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h2>Reset your password</h2>
                      <p>Hello ${user.name || 'there'},</p>
                      <p>You requested to reset your password. Click the button below to proceed:</p>
                      <p><a href="${url}" class="button">Reset Password</a></p>
                      <p>Or copy and paste this link into your browser:</p>
                      <p>${url}</p>
                      <div class="footer">
                        <p>If you didn't request this, you can safely ignore this email.</p>
                      </div>
                    </div>
                  </body>
                </html>
              `,
            })
          },
        },
        // For Payload's default SERIAL IDs:
        advanced: {
          database: {
            generateId: 'serial',
          },
        },
        baseURL: getBaseUrl(),
        secret: process.env.BETTER_AUTH_SECRET,
        trustedOrigins: [baseUrl], // Or use withBetterAuthDefaults() below
      }),
    admin: {
      disableLoginView: false,
      // beforeLoginComponent: "@/components/BeforeLogin",
      loginViewComponent: '@/components/auth/login-form',
      login: {
        requiredRole: 'admin',
        afterLoginPath: '/admin',
        enableForgotPassword: true,
      },
    },
  }),
]
