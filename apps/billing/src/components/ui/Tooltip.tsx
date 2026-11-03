import React, { forwardRef, useRef, useState, useEffect, ReactNode } from 'react'
import { useTooltips } from '../../hooks/useTooltips'

interface TooltipWrapperProps {
  /** Tooltip key from dictionary */
  tooltipKey?: string
  /** Inline tooltip content (overrides key) */
  content?: string
  /** Position of tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Delay before showing (ms) */
  delay?: number
  /** Children to wrap */
  children: ReactNode
  /** Additional className */
  className?: string
}

/**
 * TooltipWrapper - Wraps any element to show tooltip on hover/focus
 * 
 * Usage:
 *   <TooltipWrapper tooltipKey="accounts.code">
 *     <label>Code</label>
 *   </TooltipWrapper>
 * 
 *   <TooltipWrapper content="Custom help text">
 *     <span>ℹ️</span>
 *   </TooltipWrapper>
 */
export const TooltipWrapper = forwardRef<HTMLDivElement, TooltipWrapperProps>(
  ({ tooltipKey, content, position = 'top', delay = 200, children, className }, ref) => {
    const { enabled } = useTooltips()
    const [show, setShow] = useState(false)
    const [tooltipContent, setTooltipContent] = useState('')
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const wrapperRef = useRef<HTMLDivElement>(null)

    // Resolve tooltip content
    useEffect(() => {
      if (content) {
        setTooltipContent(content)
      } else if (tooltipKey) {
        // We can't use useT here directly, so we'll use the content prop or key
        // The actual translation should be done by the parent component
        setTooltipContent(tooltipKey)
      }
    }, [content, tooltipKey])

    const showTooltip = () => {
      if (!enabled || !tooltipContent) return
      timeoutRef.current = setTimeout(() => setShow(true), delay)
    }

    const hideTooltip = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setShow(false)
    }

    // Merge refs
    const mergedRef = (node: HTMLDivElement | null) => {
      wrapperRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    // Keyboard accessibility
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setShow(true)
        // Auto-hide after 5 seconds
        setTimeout(() => setShow(false), 5000)
      }
      if (e.key === 'Escape') {
        hideTooltip()
      }
    }

    const childWithProps = React.isValidElement(children)
      ? React.createElement('span', {
          ref: mergedRef,
          onMouseEnter: showTooltip,
          onMouseLeave: hideTooltip,
          onFocus: showTooltip,
          onBlur: hideTooltip,
          onKeyDown: handleKeyDown,
          tabIndex: 0,
          'aria-describedby': show ? 'tooltip-content' : undefined,
          className: className,
        }, children)
      : (
        <div
          ref={mergedRef}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
          onFocus={showTooltip}
          onBlur={hideTooltip}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          aria-describedby={show ? 'tooltip-content' : undefined}
          className={className}
        >
          {children}
        </div>
      )

    return (
      <>
        {childWithProps}
        {show && enabled && tooltipContent && (
          <div
            id="tooltip-content"
            role="tooltip"
            className={`fixed z-50 px-3 py-2 text-xs text-white bg-slate-900 rounded shadow-lg max-w-xs ${
              position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' :
              position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' :
              position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' :
              'left-full top-1/2 -translate-y-1/2 ml-2'
            }`}
            style={{ pointerEvents: 'none' }}
          >
            {tooltipContent}
            <div
              className={`absolute w-0 h-0 border-4 border-transparent ${
                position === 'top' ? 'top-full left-1/2 -translate-x-1/2 border-t-slate-900' :
                position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-900' :
                position === 'left' ? 'left-full top-1/2 -translate-y-1/2 border-l-slate-900' :
                'right-full top-1/2 -translate-y-1/2 border-r-slate-900'
              }`}
            />
          </div>
        )}
      </>
    )
  }
)

TooltipWrapper.displayName = 'TooltipWrapper'

/**
 * Simple Tooltip component for inline help icons
 */
interface TooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  className?: string
}

export function Tooltip({ content, position = 'top', children, className }: TooltipProps) {
  return (
    <TooltipWrapper content={content} position={position} className={className}>
      {children}
    </TooltipWrapper>
  )
}