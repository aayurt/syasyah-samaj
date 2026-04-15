'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface Tenant {
  id: string
  slug: string
  name: string
  description?: string
  coverImage?: string
}

interface TenantContextType {
  tenant: Tenant | null
  isMainSite: boolean
  loading: boolean
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  isMainSite: true,
  loading: true,
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function resolveTenant() {
      try {
        const cookies = document.cookie.split('; ')
        const tenantCookie = cookies.find((c) => c.startsWith('current-tenant='))
        const subdomain = tenantCookie?.split('=')[1]

        if (!subdomain) {
          setLoading(false)
          return
        }

        const res = await fetch(`/api/tenants/by-slug/${subdomain}`)
        if (res.ok) {
          const tenantData = await res.json()
          setTenant(tenantData)
        }
      } catch (error) {
        console.error('Failed to resolve tenant:', error)
      } finally {
        setLoading(false)
      }
    }

    resolveTenant()
  }, [])

  return (
    <TenantContext.Provider
      value={{
        tenant,
        isMainSite: !tenant,
        loading,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}
