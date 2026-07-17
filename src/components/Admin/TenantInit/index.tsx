'use client'

import { useEffect, useRef } from 'react'
import { useTenantSelection } from '@payloadcms/plugin-multi-tenant/client'
import { useAuth } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'

export const TenantInit: React.FC = () => {
  const { syncTenants } = useTenantSelection()
  const { user } = useAuth()
  const router = useRouter()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      await syncTenants()
      router.refresh()
    }
    init()
  }, [syncTenants, user, router])

  return null
}
