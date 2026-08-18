import type { CollectionBeforeValidateHook, PayloadRequest } from 'payload'

/**
 * P1 illaka scoping — tenant assignment on write.
 *
 * The illaka field keeps its wire name `tenant`. This hook runs on every
 * scoped collection (accounts, documents, journal-entries, parties, items,
 * stock-movements) so the field can be `required` without breaking callers
 * that don't send it (the billing SPA, the posting engine).
 *
 * Resolution order:
 *   1. If the write already carries `tenant`, keep it (central users may pick
 *      an illaka; enforcement of "can only write to your own" is the next P1
 *      step, the access hooks).
 *   2. Otherwise, if the requesting user has a `tenants` array, use their
 *      first assigned illaka.
 *   3. Otherwise (central / super-admin / system), use the C00 central row,
 *      creating it lazily the first time so `required` never blocks writes.
 */
export async function resolveTenantId(
  payload: PayloadRequest['payload'],
): Promise<number | string | undefined> {
  const found = await payload.find({
    collection: 'tenants',
    where: { code: { equals: 'C00' } },
    limit: 1,
    depth: 0,
  })
  if (found.docs[0]?.id) return found.docs[0].id as number | string

  const created = await payload.create({
    collection: 'tenants',
    data: {
      code: 'C00',
      name: 'Central Organization',
      type: 'central',
      slug: 'central-organization',
      enabled: false,
    },
    overrideAccess: true,
  })
  return created.id as number | string
}

/** Assign the tenant on create/update when the write doesn't provide one. */
export const assignTenant: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create' && operation !== 'update') return data
  if (!data) return data
  const d = data as Record<string, unknown>

  const user = req.user as
    | {
        role?: string
        tenants?: { tenant?: number | string }[]
      }
    | null
    | undefined

  const first = user?.tenants?.[0]
  const assigned = first?.tenant

  // Illaka-scoped users are hard-scoped: their writes always carry their own
  // illaka, even if the request tries to pass a different one. The collection
  // access hooks additionally block reads/updates across illakas.
  if (user && user.role && isIllakaRole(user.role)) {
    if (assigned) {
      d.tenant = assigned
      return data
    }
    // Illaka role without an assignment can't write anywhere — let required
    // validation fail rather than silently scoping to C00.
    delete d.tenant
    return data
  }

  // Keep an explicitly provided tenant for central roles (super-admin / admin
  // / central-*): they manage all books and may post into any illaka.
  if (d.tenant) return data

  // Central roles and system writes default to the C00 central row.
  const id = await resolveTenantId(req.payload)
  if (id) d.tenant = id
  return data
}

function isIllakaRole(role: string): boolean {
  return [
    'illaka-chair',
    'illaka-treasurer',
    'illaka-secretary',
    'illaka-accountant',
    'illaka-member-officer',
  ].includes(role)
}
