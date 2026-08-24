import { useCallback, useMemo, useState } from 'react'

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

interface UseSortSearchOptions<T> {
  /** Builds the haystack for the search box (lowercase matching). */
  searchable: (row: T) => string
  /** Extracts a sortable value for a column key. */
  valueOf: (row: T, key: string) => string | number | null | undefined
  defaultSort?: SortState
  /** Initial query from URL params. */
  initialQuery?: string
  /** Initial sort from URL params. */
  initialSort?: SortState
  /** Called when query or sort changes (for syncing to URL params). */
  onChange?: (query: string, sort: SortState) => void
}

/**
 * Client-side column sorting + text search for list tables.
 * Sorting is stable: `valueOf` lets pages map nested/computed columns
 * (party names, line sums, stock levels) to a plain comparable value.
 */
export function useSortSearch<T>(
  rows: T[],
  opts: UseSortSearchOptions<T>,
): {
  query: string
  setQuery: (q: string) => void
  sort: SortState
  toggleSort: (key: string) => void
  visible: T[]
} {
  const [query, _setQuery] = useState(opts.initialQuery ?? '')
  const [sort, _setSort] = useState<SortState>(
    opts.initialSort ?? opts.defaultSort ?? { key: '', dir: 'asc' },
  )

  const setQuery = useCallback((q: string) => {
    _setQuery(q)
    opts.onChange?.(q, sort)
  }, [opts.onChange, sort])

  const toggleSort = useCallback((key: string) => {
    _setSort((s) => {
      const next = s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } as SortState
        : { key, dir: 'asc' } as SortState
      opts.onChange?.(query, next)
      return next
    })
  }, [opts.onChange, query])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = q
      ? rows.filter((r) => opts.searchable(r).toLowerCase().includes(q))
      : rows
    if (sort.key) {
      const dir = sort.dir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const av = opts.valueOf(a, sort.key)
        const bv = opts.valueOf(b, sort.key)
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        const cmp =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { numeric: true })
        return cmp * dir
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort])

  return { query, setQuery, sort, toggleSort, visible }
}
