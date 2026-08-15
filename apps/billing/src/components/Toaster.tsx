import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastKind,
} from '../lib/toast'

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}

const ICON_COLORS: Record<ToastKind, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-sky-500',
}

/**
 * Renders the global toast stack (bottom-right). Purely visual — the store
 * lives in lib/toast and is driven by api.ts / the sync engine.
 */
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 print:hidden">
      {items.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${STYLES[t.kind]}`}
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${ICON_COLORS[t.kind]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              {t.message && (
                <div className="mt-0.5 truncate text-xs opacity-80" title={t.message}>
                  {t.message}
                </div>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 opacity-50 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
