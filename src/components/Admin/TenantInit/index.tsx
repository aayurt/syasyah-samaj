'use client'

import { useEffect, useRef, useState } from 'react'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'
import { useAuth } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

export const TenantInit: React.FC = () => {
  const { syncTenants, setTenant, tenant } = useTenantSelection()
  const { user } = useAuth()
  const router = useRouter()
  const initialized = useRef(false)
  
  // Track tenant changes
  const [tenantChanged, setTenantChanged] = useState(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      try {
        await syncTenants()
        
        // After syncing tenants, check if tenant was set and navigate if needed
        if (tenant?.id) {
          // Store the current tenant context
          setTenant(tenant.id)
          router.refresh()
        }
      } catch (error) {
        console.error('Error initializing tenant:', error)
      }
    }

    init()
  }, [syncTenants, tenant?.id, user, router])

  // Watch for tenant changes and fetch company details
  useEffect(() => {
    if (!tenant?.id) return
    
    // When tenant changes, we can trigger re-fetching of company details
    // This ensures the UI updates with the new company's information
    const handleTenantChange = async () => {
      try {
        await syncTenants()
        router.refresh()
        setTenantChanged(true)
      } catch (error) {
        console.error('Error syncing tenant on change:', error)
      }
    }
    
    // Set up a listener for tenant changes if the hook supports it
    // For now, we'll re-init on mount and let the parent handle updates
    handleTenantChange()
  }, [tenant?.id, syncTenants, router])

  return null
}