import React from 'react'

export default function Loading() {
  return (
    <div className="container py-28">
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-primary" />
      </div>
    </div>
  )
}
