import { LiquidButton, type LiquidButtonProps } from '@/components/ui/LiquidButton'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

import type { Page, Post } from '@/payload-types'

type LiquidAppearance = 'liquid' | 'liquid-default' | 'liquid-secondary' | 'liquid-destructive' | 'liquid-outline' | 'liquid-accent' | 'liquid-ghost'

type CMSLinkType = {
  appearance?: 'inline' | LiquidAppearance | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
      ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
          reference.value.slug
        }`
      : url

  if (!href) return null

  const size = sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  // Handle LiquidButton appearances
  if (appearance === 'liquid' || (typeof appearance === 'string' && appearance.startsWith('liquid-'))) {
    const liquidVariant = (
      appearance === 'liquid' ? 'default' : appearance.replace('liquid-', '')
    ) as LiquidButtonProps['variant']

    return (
      <LiquidButton asChild className={className} size={size} variant={liquidVariant}>
        <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
          {label && label}
          {children && children}
        </Link>
      </LiquidButton>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance as ButtonProps['variant']}>
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
