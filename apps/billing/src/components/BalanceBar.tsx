import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

/* ── Balance snap pulse ────────────────────────────────────────────
   Fires a 250ms emerald pulse the instant `diff` crosses to zero
   (only on a transition from unbalanced → balanced, so it doesn't
   re-fire on every keystroke while balanced). */
export function useBalanceSnap(diff: number) {
  const [snapping, setSnapping] = useState(false)
  const wasBalanced = useRef<boolean | null>(null) // null = first run, never snap
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const balanced = Math.abs(diff) < 0.001
    if (wasBalanced.current !== null && balanced && !wasBalanced.current) {
      setSnapping(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setSnapping(false), 250)
    }
    wasBalanced.current = balanced
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [diff])

  return snapping
}

type BalanceBarProps = {
  debit: number
  credit: number
  /** Extra read-only info rendered between the totals and the actions. */
  children?: React.ReactNode
  /** Action buttons (Save draft / Post etc.) rendered on the right. */
  actions: React.ReactNode
}

/**
 * Sticky footer balance bar for multi-line entry forms (VoucherForm
 * journal mode, Journal page). Pinned to the bottom of the viewport;
 * shows Total Debit / Total Credit / Difference in monospace with an
 * amber/red badge while unbalanced and a green ✓ + snap pulse when
 * balanced. Purely presentational — the parent owns the totals math.
 */
export default function BalanceBar({ debit, credit, children, actions }: BalanceBarProps) {
  const t = useT()
  const diff = debit - credit
  const balanced = Math.abs(diff) < 0.001
  const snapping = useBalanceSnap(diff)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-slate-500">
              Dr <span className="font-semibold text-slate-800">{fmtNum(debit)}</span>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">
              Cr <span className="font-semibold text-slate-800">{fmtNum(credit)}</span>
            </span>
          </div>
          {balanced ? (
            <span
              className={`shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ${
                snapping ? 'animate-balance-snap' : ''
              }`}
            >
              ✓ {t('vouchers.balanced', 'balanced')}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              {t('vouchers.difference', 'difference')} {fmtNum(diff)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {children}
          {actions}
        </div>
      </div>
    </div>
  )
}

function fmtNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
