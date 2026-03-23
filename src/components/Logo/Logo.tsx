import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    // <h1 className="text-4xl">Afno Events</h1>
    <>
      <img
        alt="Syasyah Samaj Logo"
        loading={loading}
        fetchPriority={priority}
        decoding="async"
        className={clsx('max-w-[9.375rem] w-full h-[100px]', className)}
        src="/logo.png"
      />
      <img
        src="/syasyah_text.svg"
        alt="Syasha Samaj"
        className={clsx('max-w-[9.375rem] w-full mt-2 ', className)}
      />
    </>
  )
}
