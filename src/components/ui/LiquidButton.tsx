'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type MotionProps } from 'framer-motion'
import { cn } from '@/utilities/ui'

const liquidButtonVariants = cva(
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-md hover:shadow-lg border border-primary/20',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:shadow-md border border-secondary/20',
        destructive:
          'bg-destructive text-destructive-foreground shadow-md hover:shadow-lg border border-destructive/20',
        outline:
          'border border-input bg-background text-foreground hover:border-primary/50 shadow-sm',
        accent:
          'bg-accent text-accent-foreground shadow-sm hover:shadow-md border border-accent/30',
        ghost:
          'text-foreground hover:bg-accent/40',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3.5 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const liquidBlobVariants: Record<string, string> = {
  default: 'bg-primary-foreground/20',
  secondary: 'bg-foreground/15',
  destructive: 'bg-white/25',
  outline: 'bg-primary/15',
  accent: 'bg-accent-foreground/20',
  ghost: 'bg-foreground/10',
}

type MotionDivProps = MotionProps & React.HTMLAttributes<HTMLDivElement>
const MotionDiv = motion.div as unknown as React.FC<MotionDivProps>

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidButtonVariants> {
  asChild?: boolean
}

const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, children, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const [filterId] = React.useState(() => `liquid-goo-${Math.random().toString(36).slice(2, 9)}`)
    const blobColorClass = liquidBlobVariants[variant || 'default'] || liquidBlobVariants.default

    if (asChild) {
      return (
        <Slot
          className={cn(liquidButtonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        className={cn(liquidButtonVariants({ variant, size, className }))}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {/* SVG Gooey Filter definition */}
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        {/* Liquid Gooey Blobs */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
          style={{ filter: `url(#${filterId})` }}
          aria-hidden="true"
        >
          {/* Main rising wave blob */}
          <MotionDiv
            className={cn('absolute -inset-x-2 -bottom-10 rounded-[45%]', blobColorClass)}
            animate={{
              height: isHovered ? '240%' : '0%',
              rotate: isHovered ? [0, 90, 180, 270, 360] : 0,
            }}
            transition={{
              height: { duration: 0.5, ease: [0.33, 1, 0.68, 1] },
              rotate: { repeat: Infinity, duration: 4, ease: 'linear' },
            }}
          />

          {/* Secondary counter-rotating wave blob for fluid liquid feel */}
          <MotionDiv
            className={cn('absolute -inset-x-2 -bottom-10 rounded-[40%]', blobColorClass)}
            animate={{
              height: isHovered ? '260%' : '0%',
              rotate: isHovered ? [360, 270, 180, 90, 0] : 360,
            }}
            transition={{
              height: { duration: 0.6, ease: [0.33, 1, 0.68, 1] },
              rotate: { repeat: Infinity, duration: 5, ease: 'linear' },
            }}
          />
        </div>

        {/* Foreground Content */}
        <span className="relative z-10 inline-flex items-center justify-center gap-2 transition-transform duration-200 group-hover:scale-105">
          {children}
        </span>
      </button>
    )
  },
)

LiquidButton.displayName = 'LiquidButton'

export { LiquidButton, liquidButtonVariants }
