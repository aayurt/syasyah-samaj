import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface TourStep {
  title: string
  body: string
  /** Route to navigate to before highlighting the target. */
  route?: string
  /** CSS selector for the element to spotlight. */
  target?: string
  placement?: 'bottom' | 'top' | 'right' | 'left'
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Sidebar navigation',
    body: 'Everything is grouped: Bookkeeping, Masters, Inventory, and Reports. Click the arrow to collapse it to icons and free up space.',
    target: 'aside',
    placement: 'right',
  },
  {
    title: 'Sync status',
    body: 'This pill shows your connection — Synced when online, “n to sync” when changes are queued, Offline when disconnected. Click it to flush pending changes.',
    target: '[data-tour="sync"]',
    placement: 'bottom',
  },
  {
    route: '/',
    title: 'Dashboard',
    body: 'Your at-a-glance overview: account count, journal entries, posted totals, and the trial balance check.',
    target: '[data-tour="dashboard-stats"]',
    placement: 'bottom',
  },
  {
    route: '/vouchers',
    title: 'Vouchers',
    body: 'Record every transaction as a voucher — sales invoices, purchase bills, payment and receipt vouchers, notes, and more. Start one with “New voucher”.',
    target: '[data-tour="new-voucher"]',
    placement: 'bottom',
  },
  {
    route: '/vouchers',
    title: 'Filter the list',
    body: 'Narrow vouchers by Type or by Status — each filter sits on its own line.',
    target: '[data-tour="voucher-filters"]',
    placement: 'right',
  },
  {
    route: '/trial-balance',
    title: 'Reports & ledgers',
    body: 'Trial balance, account ledgers, AR/AP aging, P&L, balance sheet, and daybooks. The posting engine keeps debits and credits in balance automatically.',
    target: '[data-tour="trial-report"]',
    placement: 'top',
  },
  {
    route: '/settings',
    title: 'Settings',
    body: 'Set your fiscal year start and a freeze date. Once set, nothing can be posted into the frozen period — drafts are safe, posting is blocked.',
    target: '[data-tour="settings"]',
    placement: 'top',
  },
]

const CARD_W = 320
const CARD_H = 190

function tooltipStyle(
  rect: DOMRect | null,
  placement: TourStep['placement'],
): CSSProperties {
  if (!rect) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
  }
  const gap = 12
  const clampX = (x: number) =>
    Math.max(12, Math.min(x, window.innerWidth - CARD_W - 12))
  const clampY = (y: number) =>
    Math.max(12, Math.min(y, window.innerHeight - CARD_H - 12))
  switch (placement) {
    case 'right':
      return { left: clampX(rect.right + gap), top: clampY(rect.top) }
    case 'left':
      return { left: clampX(rect.left - CARD_W - gap), top: clampY(rect.top) }
    case 'top':
      return {
        left: clampX(rect.left + rect.width / 2 - CARD_W / 2),
        top: clampY(rect.top - gap - CARD_H),
      }
    default:
      return {
        left: clampX(rect.left + rect.width / 2 - CARD_W / 2),
        top: clampY(rect.bottom + gap),
      }
  }
}

export default function Tour({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const current = TOUR_STEPS[step]

  // Position the spotlight whenever the step or route changes.
  useEffect(() => {
    if (!open) return
    const s = TOUR_STEPS[step]
    if (!s) return
    if (s.route && s.route !== location.pathname) {
      navigate(s.route)
      return
    }
    const position = () => {
      const el = s.target ? document.querySelector(s.target) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const t = setTimeout(() => {
      const el = s.target ? document.querySelector(s.target) : null
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      position()
    }, 150)
    return () => clearTimeout(t)
  }, [open, step, location.pathname, navigate])

  // Reposition on scroll/resize so the spotlight tracks its target.
  useEffect(() => {
    if (!open) return
    const s = TOUR_STEPS[step]
    if (!s) return
    const position = () => {
      const el = s.target ? document.querySelector(s.target) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    // Some targets render only after async data loads (e.g. the trial
    // balance report). Re-query whenever the DOM changes so the spotlight
    // appears the moment its target exists.
    const observer = new MutationObserver(position)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      observer.disconnect()
    }
  }, [open, step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0))
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !current) return null

  const last = step === TOUR_STEPS.length - 1
  const style = tooltipStyle(rect, current.placement)

  return (
    <>
      {/* Spotlight: a cut-out over the target, dimming everything else. */}
      {rect && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border-2 border-white"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
        />
      )}
      {/* Step card */}
      <div
        className="fixed z-[60] w-[320px] rounded-xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
        style={style}
        role="dialog"
        aria-label={current.title}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">
            {current.title}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close tour"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          {current.body}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {step + 1} / {TOUR_STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft size={12} />
                Back
              </button>
            )}
            <button
              onClick={() => (last ? onClose() : setStep((s) => s + 1))}
              className="flex items-center gap-1 rounded bg-crimson-600 px-3 py-1 text-xs font-medium text-white hover:bg-crimson-700"
            >
              {last ? 'Finish' : 'Next'}
              {!last && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
