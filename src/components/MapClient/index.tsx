'use client'
import dynamic from 'next/dynamic'
import type { Tenant } from '@/payload-types'

const IlakaMap = dynamic(() => import('@/components/IlakaMap'), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-muted animate-pulse rounded-2xl" />
})

export const MapClient = ({ tenants }: { tenants: Tenant[] }) => {
    return <IlakaMap tenants={tenants} />
}
