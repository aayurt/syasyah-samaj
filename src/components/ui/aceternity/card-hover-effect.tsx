'use client'

import React, { useState } from 'react'
import { AnimatePresence, motion, type MotionProps } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/utilities/ui'

type MotionSpanProps = MotionProps & React.HTMLAttributes<HTMLSpanElement>
const MotionSpan = motion.span as unknown as React.FC<MotionSpanProps>

export const HoverEffect = ({
  items,
  className,
}: {
  items: {
    title: string
    description: string
    link: string
    badge?: string
    icon?: React.ReactNode
    image?: string
  }[]
  className?: string
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 py-6', className)}>
      {items.map((item, idx) => (
        <Link
          href={item.link}
          key={item.link + idx}
          className="relative group block p-2 h-full w-full"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <MotionSpan
                className="absolute inset-0 h-full w-full bg-primary/10 dark:bg-primary/20 block rounded-3xl -z-0"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.15 },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.15, delay: 0.2 },
                }}
              />
            )}
          </AnimatePresence>

          <div className="rounded-2xl h-full w-full p-5 overflow-hidden bg-card border border-border group-hover:border-primary/50 relative z-10 transition-colors shadow-xs flex flex-col justify-between space-y-4">
            {item.image && (
              <div className="relative h-44 w-full rounded-xl overflow-hidden mb-2">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                {item.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20">
                    {item.badge}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-bold text-card-foreground text-base sm:text-lg group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                {item.icon}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                {item.description}
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
              <span>थप विवरण (Explore)</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
