import type { Access, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import { extractID } from '@/utilities/extractID'

/**
 * P1 illaka access enforcement (§20 of docs/illaka/PLAN.md).
 *
 * Central roles (super-admin, admin, central-*) see and write everything.
 * Illaka roles can only read/write rows whose `tenant` is their own illaka.
 * Viewer is read-only (scoped to their illaka if assigned, else org-wide).
 */

export const CENTRAL_ROLES = new Set([
  'super-admin',
  'admin',
  'central-exec',
  'central-treasurer',
  'central-auditor',
])

export const ILLAKA_ROLES = new Set([
  'illaka-chair',
  'illaka-treasurer',
  'illaka-secretary',
  'illaka-accountant',
  'illaka-member-officer',
])

const roleOf = (user: User | null | undefined): string =>
  user?.role ?? ''

export const isCentralUser = (user: User | null | undefined): boolean =>
  Boolean(user && CENTRAL_ROLES.has(roleOf(user)))

export const isIllakaUser = (user: User | null | undefined): boolean =>
  Boolean(user && ILLAKA_ROLES.has(roleOf(user)))

/** The user's accounting scope: their first assigned illaka, or undefined. */
export const userTenantId = (
  user: User | null | undefined,
): number | string | undefined => {
  const first = user?.tenants?.[0]
  return first?.tenant ? extractID(first.tenant) : undefined
}

/** A user allowed into the billing module at all (central or illaka roles). */
export const isBillingUser = (user: User | null | undefined): boolean =>
  isCentralUser(user) || isIllakaUser(user) || user?.role === 'viewer'

/**
 * Resolve the tenant filter for a report endpoint call:
 * illaka users are forced to their own illaka (server-side, not just UI);
 * central users may pass any tenant or omit it for consolidated mode.
 */
export const resolveScopedTenant = (
  req: PayloadRequest,
  explicit?: string | null,
): string | undefined => {
  if (isCentralUser(req.user)) return explicit || undefined
  const id = userTenantId(req.user)
  return id !== undefined ? String(id) : undefined
}

/** Read: central sees all; illaka/viewer are constrained to their illaka. */
export const scopedRead: Access = ({ req }) => {
  if (!req.user) return false
  if (isCentralUser(req.user)) return true
  if (req.user.role === 'viewer' || isIllakaUser(req.user)) {
    const id = userTenantId(req.user)
    return id ? { tenant: { equals: id } } : false
  }
  return false
}

/** Create: central and illaka roles may create (the beforeValidate hook
 * forces the illaka user's tenant); viewer and plain users cannot. */
export const scopedCreate: Access = ({ req }) => {
  if (!req.user) return false
  if (isCentralUser(req.user)) return true
  if (isIllakaUser(req.user)) return Boolean(userTenantId(req.user))
  return false
}

/** Update/delete: central sees all; illaka constrained to their illaka. */
export const scopedUpdate: Access = ({ req }) => {
  if (!req.user) return false
  if (isCentralUser(req.user)) return true
  if (isIllakaUser(req.user)) {
    const id = userTenantId(req.user)
    return id ? { tenant: { equals: id } } : false
  }
  return false
}

export const scopedDelete: Access = scopedUpdate
