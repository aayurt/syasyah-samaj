import { apiKeyWithDefaults } from '@delmaredigital/payload-better-auth'
import { admin } from 'better-auth/plugins'
import type { BetterAuthOptions } from 'better-auth'

export const betterAuthOptions: Partial<BetterAuthOptions> = {
  // Model names are SINGULAR - they get pluralized automatically
  // 'user' becomes 'users', 'session' becomes 'sessions', etc.
  appName: 'Afno Payload',
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user' },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
  },
  // emailAndPassword: {
  //   enabled: true,
  //   resetPasswordTokenExpiresIn: 3600, // 1 hour
  //   sendResetPassword: async ({ user, url }) => {
  //     await resend.emails.send({
  //       to: user.email,
  //       subject: 'Reset your password',
  //       html: `
  //         <p>Hello ${user.name},</p>
  //         <p>Click the link below to reset your password:</p>
  //         <a href="${url}">${url}</a>
  //         <p>If you did not request a password reset, please ignore this email.</p>
  //       `,
  //     })
  //   },
  // },
  // emailVerification: {
  //   sendOnSignUp: true,

  //   //  afterEmailVerification: async (user) => {
  //   //    await onUserEmailVerified(user);
  //   //  },
  // },
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    apple: {
      enabled: true,
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    },
  },
  plugins: [
    apiKeyWithDefaults(), // Use this instead of apiKey() for better admin UI support
    admin(),
  ],
}
