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

export function getActiveTenantId(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_KEY) || ''
}

export type TenantOption = {
  id: string
  code: string
  name: string
  type: 'central' | 'illaka'
  active?: boolean
  slug?: string
  pan?: string
  parent?: string | { id: string | number; name?: string; code?: string } | null
  parentId?: string | null
  contactInfo?: {
    phone?: string
    email?: string
  }
  location?: {
    address?: string
    city?: string
    state?: string
  }
}

export function isParentCompany(tn: TenantOption): boolean {
  if (tn.type === 'illaka' && tn.parentId) return false
  return tn.type === 'central' || !tn.parentId
}

export function getParentCompanies(tenants: TenantOption[]): TenantOption[] {
  return tenants.filter(isParentCompany)
}

export function getSubCompaniesForParent(parentId: string, tenants: TenantOption[]): TenantOption[] {
  return tenants.filter((tn) => String(tn.parentId) === String(parentId))
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
  /** Whether the user has the super-admin role. */
  isSuperAdmin: boolean
  /** The user's illaka code, if scoped (e.g. "IL03"). */
  illakaCode: string | null
  /** Whether multi-company / sub-companies mode is enabled by super-admin. */
  multiCompanyEnabled: boolean
}

const TenantContext = createContext<TenantCtx>({
  tenantId: '',
  setTenantId: () => {},
  tenants: [],
  isCentral: false,
  isIllaka: false,
  isSuperAdmin: false,
  illakaCode: null,
  multiCompanyEnabled: false,
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
  let role = (session?.user as any)?.role as string | undefined
  if (!role && typeof window !== 'undefined' && window.localStorage.getItem('__e2e_bypass__') === '1') {
    role = window.localStorage.getItem('__e2e_role__') || 'super-admin'
  }

  const isCentral = CENTRAL_ROLES.has(role || '')
  const isIllaka = ILLAKA_ROLES.has(role || '')
  const isSuperAdmin = role === 'super-admin'

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
  const [multiCompanyEnabled, setMultiCompanyEnabled] = useState<boolean>(true)

  const refreshSettings = () => {
    api<any>('/globals/billing-settings')
      .then((settings) => {
        if (settings?.multiCompanyEnabled != null) {
          setMultiCompanyEnabled(Boolean(settings.multiCompanyEnabled))
        } else {
          setMultiCompanyEnabled(true)
        }
      })
      .catch(() => {
        setMultiCompanyEnabled(true)
      })
  }

  const refreshTenants = () => {
    if (!isCentral) return
    api<{ docs: any[] }>('/tenants', { query: { limit: 100, depth: 0 } })
      .then((res) => {
        const opts = res.docs.map((t) => {
          const parentId = t.parent
            ? typeof t.parent === 'object'
              ? String(t.parent.id)
              : String(t.parent)
            : null
          return {
            id: String(t.id),
            code: t.code || '',
            name: t.name || t.slug || '',
            type: (t.type || 'illaka') as 'central' | 'illaka',
            active: t.active,
            slug: t.slug,
            pan: t.pan || '',
            parent: t.parent || null,
            parentId,
            contactInfo: t.contactInfo || null,
            location: t.location || null,
          }
        })
        setTenants(opts)
        const savedId = localStorage.getItem(STORAGE_KEY)
        if (savedId && opts.length > 0 && !opts.some((o) => o.id === savedId)) {
          setTenantIdRaw('')
          localStorage.removeItem(STORAGE_KEY)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    refreshSettings()
    refreshTenants()
    const handleChanged = () => {
      refreshSettings()
      refreshTenants()
    }
    window.addEventListener('billing-settings-changed', handleChanged)
    return () => window.removeEventListener('billing-settings-changed', handleChanged)
  }, [isCentral])

  const setTenantId = (id: string) => {
    if (isIllaka) return // locked — no-op
    setTenantIdRaw(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  // Keep the sync engine's cache key mapper in sync with the current tenant.
  useEffect(() => {
    try {
      import('./api').then(({ getEngine }) => {
        getEngine().setTenant(tenantId)
      })
    } catch { /* ignore */ }
  }, [tenantId])

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        setTenantId,
        tenants,
        isCentral,
        isIllaka,
        isSuperAdmin,
        illakaCode,
        multiCompanyEnabled,
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
