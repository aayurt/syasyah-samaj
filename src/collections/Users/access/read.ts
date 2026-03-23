import type { User } from '@/payload-types'
import type { Access, Where } from 'payload'
import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

import { isSuperAdmin } from '../../../access/isSuperAdmin'
import { getUserTenantIDs } from '../../../utilities/getUserTenantIDs'
import { isAccessingSelf } from './isAccessingSelf'
import { getCollectionIDType } from '@/utilities/getCollectionIDType'

export const readAccess: Access<User> = ({ req, id }) => {
  if (!req?.user) {
    return false
  }

  if (isAccessingSelf({ id, user: req.user })) {
    return true
  }

  const superAdmin = isSuperAdmin(req.user)
  const selectedTenant = getTenantFromCookie(
    req.headers,
    getCollectionIDType({ payload: req.payload, collectionSlug: 'tenants' }),
  )

  const adminTenantAccessIDs = getUserTenantIDs(req.user, 'tenant-admin')

  // Use cookie first, fallback to X-Tenant header
  const finalSelectedTenant = selectedTenant || req.headers.get('x-tenant')

  if (finalSelectedTenant) {
    // If it's a super admin, or they have access to the tenant ID
    const hasTenantAccess = adminTenantAccessIDs.some((id) => id === finalSelectedTenant)
    if (superAdmin || hasTenantAccess) {
      return {
        'tenants.tenant': {
          equals: finalSelectedTenant,
        },
      }
    }
  }
  if (superAdmin) {
    return true
  }

  return {
    or: [
      {
        id: {
          equals: req.user.id,
        },
      },
      {
        'tenants.tenant': {
          in: adminTenantAccessIDs,
        },
      },
    ],
  } as Where
}
