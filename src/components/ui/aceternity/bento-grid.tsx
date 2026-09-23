'use client'

import React from 'react'
import { cn } from '@/utilities/ui'

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) => {
  return (
    <div
      className={cn(
        'grid md:auto-rows-[19rem] grid-cols-1 md:grid-cols-3 gap-5 max-w-7xl mx-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  footer,
}: {
  className?: string
  title?: string | React.ReactNode
  description?: string | React.ReactNode
  header?: React.ReactNode
  icon?: React.ReactNode
  footer?: React.ReactNode
}) => {
  return (
    <div
      className={cn(
        'row-span-1 rounded-2xl group/bento hover:shadow-xl transition duration-300 shadow-input dark:shadow-none p-5 bg-card border border-border justify-between flex flex-col space-y-4 hover:border-primary/50 relative overflow-hidden',
        className,
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200 space-y-2">
        {icon}
        <div className="font-serif font-bold text-card-foreground text-base sm:text-lg">
          {title}
        </div>
        <div className="font-sans text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {description}
        </div>
      </div>
      {footer}
    </div>
  )
}
