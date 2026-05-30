'use client'

import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

interface IlakaMapProps {
  tenants: any[]
}

const IlakaMap: React.FC<IlakaMapProps> = ({ tenants }) => {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return <div className="h-[500px] w-full bg-muted animate-pulse rounded-xl" />

  const validTenants = tenants.filter(t => t.location?.latitude && t.location?.longitude)
  const center: [number, number] = validTenants.length > 0
    ? [validTenants[0].location.latitude, validTenants[0].location.longitude]
    : [27.7172, 85.3240] // Default to Kathmandu

  return (
    <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-xl border relative z-0">
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validTenants.map((tenant) => (
          <Marker
            key={tenant.id}
            position={[tenant.location.latitude, tenant.location.longitude]}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg">{tenant.name}</h3>
                <p className="text-sm my-2">{tenant.description}</p>
                <a
                  href={`/ilaka/${tenant.slug}`}
                  className="text-primary font-medium hover:underline"
                >
                  View Ilaka Dashboard
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default IlakaMap
