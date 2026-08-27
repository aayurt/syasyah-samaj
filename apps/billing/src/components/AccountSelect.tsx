import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { Account } from '../lib/types'

interface AccountSelectProps {
  accounts: Account[]
  value: string | number
  onChange: (id: string) => void
  placeholder?: string
}

/**
 * Custom searchable account dropdown.
 * Shows code · name in the trigger, type-ahead search in the panel.
 */
export default function AccountSelect({ accounts, value, onChange, placeholder = '— select account —' }: AccountSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = accounts.find((a) => String(a.id) === String(value))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = accounts.filter((a) => {
    if (!query) return true
    const q = query.toLowerCase()
    const code = a.code ? String(a.code).toLowerCase() : ''
    return a.name.toLowerCase().includes(q) || code.includes(q)
  })

  const TYPE_COLORS: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-600',
    liability: 'bg-amber-50 text-amber-600',
    equity: 'bg-purple-50 text-purple-600',
    income: 'bg-emerald-50 text-emerald-600',
    expense: 'bg-red-50 text-red-600',
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-[36px] w-full items-center gap-2 rounded border px-3 text-left text-sm transition-colors ${
          open ? 'border-crimson-400 ring-1 ring-crimson-200' : 'border-slate-300 hover:border-slate-400'
        } ${selected ? 'text-slate-800' : 'text-slate-400'}`}
      >
        {selected ? (
          <>
            {selected.code && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                {selected.code}
              </span>
            )}
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts…"
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Clear option */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              — clear selection —
            </button>
          )}

          {/* Options */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-slate-400">No accounts match</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(String(a.id)); setOpen(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    String(a.id) === String(value) ? 'bg-crimson-50 text-crimson-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {a.code && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                      {a.code}
                    </span>
                  )}
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.type && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${TYPE_COLORS[a.type] || 'bg-slate-50 text-slate-500'}`}>
                      {a.type}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
