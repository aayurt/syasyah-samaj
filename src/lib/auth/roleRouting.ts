'use client'

import type { User } from 'better-auth'

export function getPostLoginRedirect(user: (User & { role?: string }) | null): string {
  if (!user) return '/login'

  const role = (user as any)?.role

  if (role === 'admin' || role === 'super-admin') {
    return '/portal'
  }

  if (role === 'treasurer' || role === 'accountant') {
    return '/app'
  }

  if (role === 'coordinator') {
    return '/portal/coordinator'
  }

  // Default: member or any other role
  return '/portal'
}

export type RoleRedirectMap = {
  admin: '/portal'
  super_admin: '/portal'
  treasurer: '/app'
  accountant: '/app'
  coordinator: '/portal/coordinator'
  member: '/portal'
}