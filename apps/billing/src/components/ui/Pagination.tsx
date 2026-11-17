import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'
import type { PaginationState, PaginationActions } from '../../lib/usePagination'

interface PaginationProps {
  state: PaginationState
  actions: PaginationActions
  className?: string
}

export function Pagination({ state, actions, className }: PaginationProps) {
  const { page, totalPages, total, pageSize, hasNext, hasPrev } = state
  const { setPage, setPageSize, next, prev, first, last } = actions

  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  const maxVisible = 3
  let start = Math.max(1, page - maxVisible)
  let end = Math.min(totalPages, page + maxVisible)

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('...')
  }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...')
    pages.push(totalPages)
  }

  const showSize = total > pageSize

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-2 text-xs ${className ?? ''}`}
      aria-label="Pagination"
    >
      <div className="flex items-center gap-1">
        <button
          onClick={first}
          disabled={!hasPrev}
          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50"
          aria-label="First page"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={prev}
          disabled={!hasPrev}
          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        {pages.map((p) => {
          const active = p === page
          if (p === '...') {
            return (
              <span key="gap" className="px-2 py-1 rounded text-slate-400">
                …
              </span>
            )
          }
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-2.5 py-1 rounded ${active
                ? 'bg-crimson-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={next}
          disabled={!hasNext}
          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={last}
          disabled={!hasNext}
          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50"
          aria-label="Last page"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-[10px]">
          {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
        </span>
        {showSize && (
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-6 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-700 outline-none focus:border-crimson-600"
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
    </nav>
  )
}
