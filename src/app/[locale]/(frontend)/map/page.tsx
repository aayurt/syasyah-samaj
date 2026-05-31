import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { MapClient } from '@/components/MapClient'

export default async function MapPage() {
  const payload = await getPayload({ config })

  const tenants = await payload.find({
    collection: 'tenants',
    limit: 100,
  })

  return (
    <div className="container mx-auto py-20 px-4">
      <div className="max-w-4xl mx-auto mb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Community Ilaka Map
        </h1>
        <p className="text-xl text-muted-foreground">
          Explore our community across different regions. Find your local Ilaka and connect with members.
        </p>
      </div>

      <MapClient tenants={tenants.docs} />

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 rounded-xl border bg-card">
            <h3 className="text-xl font-bold mb-2">Find Local Events</h3>
            <p className="text-muted-foreground text-sm">Click on a marker to see upcoming events and activities in that specific Ilaka.</p>
        </div>
        <div className="p-6 rounded-xl border bg-card">
            <h3 className="text-xl font-bold mb-2">Connect with Members</h3>
            <p className="text-muted-foreground text-sm">Our community spans multiple regions, bringing people together through shared heritage.</p>
        </div>
        <div className="p-6 rounded-xl border bg-card">
            <h3 className="text-xl font-bold mb-2">Historical Insights</h3>
            <p className="text-muted-foreground text-sm">Each Ilaka has its own unique story. Explore the dashboards to learn more.</p>
        </div>
      </div>
    </div>
  )
}
