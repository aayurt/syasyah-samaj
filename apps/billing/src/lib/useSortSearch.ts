import { useMemo, useState } from 'react'

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
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>(
    opts.defaultSort ?? { key: '', dir: 'asc' },
  )

  const toggleSort = (key: string) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )

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
