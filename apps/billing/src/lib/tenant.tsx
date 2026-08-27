import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authClient } from './auth'
import { api } from './api'

/**
 * P1 illaka scoping for the billing SPA (§21 of docs/illaka/PLAN.md).
 *
 * The current tenant (illaka) is stored in localStorage as 'billing.tenant'.
 * Central roles can switch between tenants; illaka-scoped roles are locked.
 */

const STORAGE_KEY = 'billing.tenant'

export type TenantOption = {
  id: string
  code: string
  name: string
  type: 'central' | 'illaka'
}

type TenantCtx = {
  /** The current tenant id (string). Empty string means "All (consolidated)". */
  tenantId: string
  /** Set by central users via the switcher. No-op for illaka-scoped users. */
  setTenantId: (id: string) => void
  /** All tenants loaded from the server (for central users). */
  tenants: TenantOption[]
  /** Whether the user is a central role (sees the switcher). */
  isCentral: boolean
  /** Whether the user is an illaka-scoped role (locked chip). */
  isIllaka: boolean
  /** The user's illaka code, if scoped (e.g. "IL03"). */
  illakaCode: string | null
}

const TenantContext = createContext<TenantCtx>({
  tenantId: '',
  setTenantId: () => {},
  tenants: [],
  isCentral: false,
  isIllaka: false,
  illakaCode: null,
})

const CENTRAL_ROLES = new Set([
  'super-admin', 'admin', 'central-exec', 'central-treasurer', 'central-auditor',
])
const ILLAKA_ROLES = new Set([
  'illaka-chair', 'illaka-treasurer', 'illaka-secretary',
  'illaka-accountant', 'illaka-member-officer',
])

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession()
  const role = (session?.user as any)?.role as string | undefined

  const isCentral = CENTRAL_ROLES.has(role || '')
  const isIllaka = ILLAKA_ROLES.has(role || '')

  // For illaka users, their tenant comes from the user's tenants array
  const userTenants = (session?.user as any)?.tenants as
    | { tenant: { id: string; code?: string; name?: string } }[]
    | undefined
  const lockedTenantId =
    isIllaka && userTenants?.[0]?.tenant
      ? String(userTenants[0].tenant.id)
      : null
  const illakaCode =
    isIllaka && userTenants?.[0]?.tenant?.code
      ? userTenants[0].tenant.code
      : null

  // Central users: initialise from localStorage, default to C00
  const [tenantId, setTenantIdRaw] = useState<string>(() => {
    if (isIllaka && lockedTenantId) return lockedTenantId
    return localStorage.getItem(STORAGE_KEY) || ''
  })

  const [tenants, setTenants] = useState<TenantOption[]>([])

  // Load tenants for the switcher (central users only)
  useEffect(() => {
    if (!isCentral) return
    api<{ docs: any[] }>('/tenants', { query: { limit: 100, depth: 0 } })
      .then((res) => {
        const opts = res.docs.map((t) => ({
          id: String(t.id),
          code: t.code || '',
          name: t.name || t.slug || '',
          type: (t.type || 'illaka') as 'central' | 'illaka',
        }))
        setTenants(opts)
        // If no tenant is selected yet, default to empty (consolidated)
        if (!localStorage.getItem(STORAGE_KEY)) {
          setTenantIdRaw('')
        }
      })
      .catch(() => {})
  }, [isCentral])

  const setTenantId = (id: string) => {
    if (isIllaka) return // locked — no-op
    setTenantIdRaw(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        setTenantId,
        tenants,
        isCentral,
        isIllaka,
        illakaCode,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  return useContext(TenantContext)
}

/** Returns the tenant query parameter to pass to all API calls. */
export function useTenantQuery(): Record<string, string | number | undefined> {
  const { tenantId } = useTenant()
  return useMemo(
    () => (tenantId ? { tenant: tenantId } : {}),
    [tenantId],
  )
}
