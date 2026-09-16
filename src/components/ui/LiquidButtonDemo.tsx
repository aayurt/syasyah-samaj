'use client'

import * as React from 'react'
import { PlusIcon } from 'lucide-react'
import {
  LiquidButton,
  type LiquidButtonProps,
} from '@/components/animate-ui/components/buttons/liquid'

interface LiquidButtonDemoProps {
  variant?: LiquidButtonProps['variant']
  size?: LiquidButtonProps['size']
  label?: string
}

export default function LiquidButtonDemo({
  variant = 'default',
  size = 'default',
  label = 'Hover me',
}: LiquidButtonDemoProps) {
  return (
    <LiquidButton variant={variant} size={size}>
      {size === 'icon' ? <PlusIcon /> : label}
    </LiquidButton>
  )
}
