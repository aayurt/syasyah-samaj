// src/lib/auth/client.ts
'use client'

import { createPayloadAuthClient } from '@delmaredigital/payload-better-auth/client'

// Pre-configured with twoFactor, apiKey, and passkey plugins
// Uses window.location.origin automatically - works on any deployment URL
export const authClient = createPayloadAuthClient()

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  twoFactor,
  passkey,
  resetPassword,
  requestPasswordReset,
} = authClient
