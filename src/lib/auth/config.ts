import { apiKeyWithDefaults } from '@delmaredigital/payload-better-auth'
import type { BetterAuthOptions } from 'better-auth'
import { admin, emailOTP } from 'better-auth/plugins'

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
  emailAndPassword: { enabled: true },
  emailVerification: {
     sendOnSignUp: true,
     
    //  afterEmailVerification: async (user) => {
    //    await onUserEmailVerified(user);
    //  },
   },
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
    
      apiKeyWithDefaults(),  // Use this instead of apiKey() for better admin UI support

    admin(),
    emailOTP(
        {otpLength: 6,
       expiresIn: 300, // 5 minutes
       sendVerificationOnSignUp: true,
       overrideDefaultEmailVerification: true,
       async sendVerificationOTP({ email, otp, type }) {
        console.log(`Sending ${type} OTP`, otp, `to email:`, email)}
}
    ),
    
  ]
 
}
