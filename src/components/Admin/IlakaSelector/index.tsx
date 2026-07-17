'use client'

import React, { useEffect, useState } from 'react'
import { useField, useForm } from '@payloadcms/ui'

interface Ilaka {
  id: string
  name: string
  slug: string
  coverImage?: { url?: string }
  location?: { address?: string }
}

export const IlakaSelector: React.FC = () => {
  const { setValue, value } = useField<number | string>({ path: 'tenant' })
  const { dispatchFields } = useForm()
  const [ilakas, setIlakas] = useState<Ilaka[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIlakas() {
      try {
        const res = await fetch('/api/tenants?limit=100&depth=1')
        if (res.ok) {
          const data = await res.json()
          setIlakas(data.docs || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchIlakas()
  }, [])

  const selectedId = value ? String(value) : null

  if (loading) {
    return (
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (ilakas.length === 0) return null

  return (
    <div className="ilaka-selector-wrapper" style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        marginBottom: '0.5rem',
        color: 'var(--theme-elevation-800)',
      }}>
        Select Ilaka
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {ilakas.map((ilaka) => {
          const isSelected = selectedId === ilaka.id
          return (
            <button
              key={ilaka.id}
              type="button"
              onClick={() => {
                if (isSelected) return
                setValue(ilaka.id)
                dispatchFields({
                  type: 'UPDATE',
                  path: 'tenant',
                  value: ilaka.id,
                })
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.75rem',
                border: isSelected ? '2px solid var(--theme-success-500)' : '1px solid var(--theme-elevation-200)',
                background: isSelected ? 'var(--theme-success-50)' : 'var(--theme-input-bg)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: isSelected ? 600 : 400,
                color: 'var(--theme-elevation-800)',
                transition: 'all 0.15s ease',
                outline: 'none',
                minWidth: '120px',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--theme-elevation-400)'
                  e.currentTarget.style.background = 'var(--theme-elevation-50)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--theme-elevation-200)'
                  e.currentTarget.style.background = 'var(--theme-input-bg)'
                }
              }}
            >
              {ilaka.coverImage?.url && (
                <img
                  src={ilaka.coverImage.url}
                  alt=""
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              )}
              <span>{ilaka.name}</span>
              {isSelected && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--theme-success-500)" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
