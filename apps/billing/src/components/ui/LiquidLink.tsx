import * as React from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export interface LiquidLinkProps extends LinkProps {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 shadow-xs',
  secondary:
    'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 shadow-xs',
  accent:
    'bg-crimson-600 text-white hover:bg-crimson-700 border border-crimson-600 shadow-xs',
  outline:
    'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-xs',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 border border-red-600 shadow-xs',
}

const blobStyles: Record<string, string> = {
  primary: 'bg-white/20',
  secondary: 'bg-slate-900/10',
  accent: 'bg-white/25',
  outline: 'bg-slate-900/10',
  ghost: 'bg-slate-900/10',
  danger: 'bg-white/25',
}

const sizeStyles: Record<string, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-4 text-base gap-2 rounded-xl',
  icon: 'h-8 w-8 p-0 rounded-lg justify-center',
}

export const LiquidLink = React.forwardRef<HTMLAnchorElement, LiquidLinkProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      children,
      to,
      ...props
    },
    ref,
  ) => {
    const [filterId] = React.useState(
      () => `liquid-billing-link-${Math.random().toString(36).slice(2, 9)}`,
    )
    const baseVariant = variantStyles[variant] || variantStyles.primary
    const baseSize = sizeStyles[size] || sizeStyles.md
    const blobColor = blobStyles[variant] || blobStyles.primary

    return (
      <Link
        ref={ref}
        to={to}
        className={`group relative inline-flex items-center justify-center overflow-hidden font-medium transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${baseVariant} ${baseSize} ${className}`}
        {...props}
      >
        {/* SVG Gooey Filter */}
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        {/* Liquid wave blobs container */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
          style={{ filter: `url(#${filterId})` }}
          aria-hidden="true"
        >
          <span
            className={`absolute -inset-x-2 -bottom-8 h-0 rounded-[45%] transition-all duration-500 ease-out group-hover:h-[240%] group-hover:rotate-180 ${blobColor}`}
          />
          <span
            className={`absolute -inset-x-2 -bottom-8 h-0 rounded-[40%] transition-all duration-700 ease-out group-hover:h-[260%] group-hover:-rotate-180 ${blobColor}`}
          />
        </div>

        {/* Content */}
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5 transition-transform duration-200 group-hover:scale-105">
          {children}
        </span>
      </Link>
    )
  },
)

LiquidLink.displayName = 'LiquidLink'
