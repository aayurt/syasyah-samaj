import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpenText,
  Boxes,
  FileText,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { api } from '../lib/api'

/* ------------------------------------------------------------------ */
/*  Shortcut definitions                                              */
/* ------------------------------------------------------------------ */

interface Shortcut {
  label: string
  icon: LucideIcon
  route: string
  shortcut?: string
  color: string
}

const SHORTCUTS: Shortcut[] = [
  { label: 'Sales Entry', icon: ArrowUpRight, route: '/vouchers', shortcut: '⌥S', color: 'text-emerald-600' },
  { label: 'Purchase Entry', icon: ShoppingCart, route: '/vouchers', shortcut: '⌥P', color: 'text-emerald-600' },
  { label: 'Payment Entry', icon: Send, route: '/vouchers', shortcut: '⌥I', color: 'text-emerald-600' },
  { label: 'Receipt Entry', icon: Receipt, route: '/vouchers', shortcut: '⌥O', color: 'text-emerald-600' },
  { label: 'Journal Entry', icon: BookOpenText, route: '/vouchers', shortcut: '⌥J', color: 'text-emerald-600' },
  { label: 'Contra Entry', icon: RefreshCw, route: '/vouchers', shortcut: '⌥T', color: 'text-emerald-600' },
  { label: 'Credit Note', icon: RotateCcw, route: '/vouchers', shortcut: '⌥C', color: 'text-emerald-600' },
  { label: 'Add Item', icon: Boxes, route: '/inventory', shortcut: '⌥M', color: 'text-emerald-600' },
  { label: 'Add Party', icon: Users, route: '/parties', shortcut: '⌥N', color: 'text-emerald-600' },
  { label: 'Dashboard', icon: LayoutDashboard, route: '/', shortcut: '⌥D', color: 'text-emerald-600' },
]

/* ------------------------------------------------------------------ */
/*  Search result types                                                */
/* ------------------------------------------------------------------ */

interface SearchResult {
  type: 'document' | 'party' | 'item'
  id: number | string
  label: string
  sub?: string
  route: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      // Small delay so the DOM is mounted
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search as user types (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    let alive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.trim()
        const [docRes, partyRes, itemRes] = await Promise.allSettled([
          api<{ docs: any[] }>(`/documents`, {
            query: { where: { number: { contains: q } }, limit: 5, depth: 0 } as any,
          }),
          api<{ docs: any[] }>(`/parties`, {
            query: { where: { name: { contains: q } }, limit: 5, depth: 0 } as any,
          }),
          api<{ docs: any[] }>(`/items`, {
            query: { where: { name: { contains: q } }, limit: 5, depth: 0 } as any,
          }),
        ])
        if (!alive) return
        const hits: SearchResult[] = []
        if (docRes.status === 'fulfilled') {
          for (const d of docRes.value.docs || []) {
            hits.push({
              type: 'document',
              id: d.id,
              label: d.number || d.docType,
              sub: `${d.docType} · ${d.status || 'draft'}`,
              route: '/vouchers',
            })
          }
        }
        if (partyRes.status === 'fulfilled') {
          for (const p of partyRes.value.docs || []) {
            hits.push({
              type: 'party',
              id: p.id,
              label: p.name,
              sub: p.phone || p.email || '',
              route: '/parties',
            })
          }
        }
        if (itemRes.status === 'fulfilled') {
          for (const i of itemRes.value.docs || []) {
            hits.push({
              type: 'item',
              id: i.id,
              label: i.name,
              sub: i.sku || '',
              route: '/inventory',
            })
          }
        }
        setResults(hits)
        setActiveIdx(0)
      } catch {
        // search is best-effort
      } finally {
        if (alive) setLoading(false)
      }
    }, 300)
    return () => { alive = false; clearTimeout(timer) }
  }, [query])

  const go = (route: string) => {
    navigate(route)
    onClose()
  }

  // Keyboard navigation
  const items = query.trim() ? results : SHORTCUTS
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIdx]
      if (item) {
        if ('route' in item) go(item.route)
      }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for transactions, parties & inventory…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {query.trim() ? (
            /* ---- Search results ---- */
            loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                <RefreshCw size={14} className="mr-2 animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => go(r.route)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      i === activeIdx ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      {r.type === 'document' && <FileText size={14} />}
                      {r.type === 'party' && <Users size={14} />}
                      {r.type === 'item' && <Boxes size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-700">{r.label}</div>
                      {r.sub && (
                        <div className="truncate text-xs text-slate-400">{r.sub}</div>
                      )}
                    </div>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-400">
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* ---- Shortcut grid ---- */
            <>
              <div className="mb-2 px-1 text-xs font-medium text-slate-400">
                Shortcuts (for adding data)
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SHORTCUTS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.label}
                      onClick={() => go(s.route)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex flex-col items-center gap-2 rounded-lg border border-slate-100 px-3 py-4 text-center transition-colors ${
                        i === activeIdx
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={20} className={s.color} />
                      <span className="text-xs font-medium text-slate-700">{s.label}</span>
                      {s.shortcut && (
                        <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {s.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px]">⌘K</kbd>
          {' '}to open · {' '}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px]">↑↓</kbd>
          {' '}to navigate · {' '}
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px]">↵</kbd>
          {' '}to select
        </div>
      </div>
    </div>
  )
}
