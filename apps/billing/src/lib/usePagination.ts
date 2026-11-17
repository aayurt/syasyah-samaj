import { useCallback, useMemo, useState } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
  offset: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginationActions {
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
}

/**
 * Client-side pagination over an already-filtered/sorted array.
 * Returns the slice for the current page plus pagination state/actions.
 */
export function usePagination<T>(
  rows: T[],
  { pageSize = 25, initialPage = 1 }: { pageSize?: number; initialPage?: number } = {},
) {
  const [page, setPageState] = useState(initialPage)
  const [pageSizeState, setPageSizeState] = useState(pageSize)

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSizeState))
  const clampedPage = Math.min(Math.max(page, 1), totalPages)
  const offset = (clampedPage - 1) * pageSizeState
  const pageRows = rows.slice(offset, offset + pageSizeState)
  const hasNext = clampedPage < totalPages
  const hasPrev = clampedPage > 1

  const setPage = useCallback((p: number) => setPageState(p), [])
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPageState(1)
  }, [])

  const next = useCallback(() => setPageState((p) => Math.min(p + 1, totalPages)), [totalPages])
  const prev = useCallback(() => setPageState((p) => Math.max(p - 1, 1)), [])
  const first = useCallback(() => setPageState(1), [])
  const last = useCallback(() => setPageState(totalPages), [totalPages])

  const state: PaginationState = {
    page: clampedPage,
    pageSize: pageSizeState,
    total,
    totalPages,
    offset,
    hasNext,
    hasPrev,
  }
  const actions: PaginationActions = { setPage, setPageSize, next, prev, first, last }

  return { pageRows, state, actions }
}
