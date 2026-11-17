import { apiKeyWithDefaults } from '@delmaredigital/payload-better-auth'
import { admin, bearer } from 'better-auth/plugins'
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
    // cookie: { secure, sameSite } — not a valid BetterAuthOptions.session
    // property in this version; cookie flags handled by better-auth defaults.
    // ponytail: cookie config ceiling = better-auth defaults; add when a
    // supported cookie option surface appears in the version's types.
  },
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      // Dev-only: no email provider wired. Reset link is logged; use the URL directly.
      console.log(`[seed] password-reset link for ${user.email}: ${url}`)
    },
  },
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
    bearer(),
  ],
}
