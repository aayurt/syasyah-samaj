import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  className?: string
  minWidth?: number
}

/**
 * Renders children in a portal attached to document.body.
 * Positions itself below the anchor element, avoiding overflow:hidden clipping.
 */
export default function Popover({
  open,
  onClose,
  anchorRef,
  children,
  className = '',
  minWidth,
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  // Position the popover below the anchor
  useEffect(() => {
    if (!open || !anchorRef.current) return
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={`absolute z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ${className}`}
      style={{
        top: pos.top,
        left: pos.left,
        width: minWidth ? Math.max(pos.width, minWidth) : pos.width,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
