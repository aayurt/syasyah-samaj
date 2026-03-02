import type { AccessArgs } from 'payload'

import type { User } from '@/payload-types'

type isAdminType = (args: AccessArgs<User>) => boolean

export const authenticated: isAdminType = ({ req: { user } }) => {
  return Boolean(user)
}

export const isAdmin: isAdminType = ({ req: { user } }) => {
  // Scenario #1 - Check if user has the 'admin' role
  if (user && (user.role === 'admin' || user.role === 'super-admin')) {
    return true
  }

  return false
}
