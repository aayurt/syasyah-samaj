import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export interface SearchSelectOption {
  value: string | number
  label: string
  sublabel?: string
  badge?: string
}

interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
}

/**
 * Generic searchable dropdown. Works with any option list.
 * Replaces native <select> for a polished, searchable UI.
 */
export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = '— select —',
  emptyLabel = '— clear selection —',
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => String(o.value) === String(value))

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

  const filtered = options.filter((o) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    )
  })

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex h-[38px] w-full items-center gap-2 rounded border px-3 text-left text-sm transition-colors ${
          open ? 'border-crimson-400 ring-1 ring-crimson-200' : 'border-slate-300 hover:border-slate-400'
        } ${selected ? 'text-slate-800' : 'text-slate-400'}`}
      >
        {selected ? (
          <>
            <span className="flex-1 truncate">{selected.label}</span>
            {selected.sublabel && (
              <span className="shrink-0 text-xs text-slate-400">{selected.sublabel}</span>
            )}
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
          {options.length > 6 && (
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Clear option */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
            >
              {emptyLabel}
            </button>
          )}

          {/* Options */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-slate-400">No options match</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(String(o.value)); setOpen(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    String(o.value) === String(value) ? 'bg-crimson-50 text-crimson-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.sublabel && <span className="shrink-0 text-xs text-slate-400">{o.sublabel}</span>}
                  {o.badge && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {o.badge}
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
