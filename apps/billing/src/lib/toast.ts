/**
 * Tiny global toast store. Module-level (no React context) so the API client
 * and sync engine can fire toasts from anywhere; the <Toaster /> component
 * subscribes and renders them.
 */
export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const AUTO_DISMISS_MS = 5000

function emit() {
  const snapshot = [...toasts]
  for (const fn of listeners) fn(snapshot)
}

export function pushToast(
  kind: ToastKind,
  title: string,
  message?: string,
): void {
  const id = nextId++
  toasts = [...toasts, { id, kind, title, message }]
  if (toasts.length > 4) toasts.shift()
  emit()
  const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
  timers.set(id, timer)
}

export function dismissToast(id: number): void {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn)
  fn([...toasts])
  return () => listeners.delete(fn)
}
