'use client'

import React from 'react'

const ILKA_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#6366f1', '#84cc16', '#d946ef',
]

function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ILKA_COLORS[Math.abs(hash) % ILKA_COLORS.length] || '#3b82f6'
}

export const IlakaBadge: React.FC<{ name?: string | null }> = ({ name }) => {
  if (!name) return null

  const color = hashColor(name)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: color,
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )
}
