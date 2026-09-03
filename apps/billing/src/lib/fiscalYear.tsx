import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useTenant } from './tenant'
import type { FiscalYear } from './types'

/**
 * Fiscal year selection for the billing SPA (Manager.io-style periods).
 *
 * Loads the fiscal-years collection for the current tenant, defaults the
 * selection to the year flagged `isActive` (or the first active year), and
 * persists the selection per tenant in localStorage so the user's working
 * period survives reloads.
 */

const STORAGE_PREFIX = 'billing.fiscalYear.'

type FiscalYearCtx = {
  /** All fiscal years for the current tenant (sorted by startDate desc). */
  years: FiscalYear[]
  /** The currently selected working year, or null when none exists. */
  selectedYear: FiscalYear | null
  /** The default working year (isActive flag), or null. */
  activeYear: FiscalYear | null
  /** Select a year (no-op for closed years is handled by callers). */
  selectYear: (id: number | null) => void
  /** True while the years list is loading. */
  loading: boolean
  /** Reload years from the server. */
  refresh: () => Promise<void>
}

const FiscalYearContext = createContext<FiscalYearCtx>({
  years: [],
  selectedYear: null,
  activeYear: null,
  selectYear: () => {},
  loading: true,
  refresh: async () => {},
})

export function FiscalYearProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useTenant()
  const [years, setYears] = useState<FiscalYear[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${tenantId}`, [tenantId])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ docs: FiscalYear[] }>('/fiscal-years', {
        query: {
          limit: 100,
          depth: 0,
          sort: '-startDate',
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      const list = (res.docs || []).sort((a, b) =>
        String(b.startDate || '').localeCompare(String(a.startDate || '')),
      )
      setYears(list)
      // Keep selection: explicit stored id → isActive → first active → first
      const stored = Number(localStorage.getItem(storageKey) || '') || null
      const active = list.find((y) => y.isActive) || list.find((y) => y.status === 'active') || null
      const keep = stored
        ? (list.find((y) => y.id === stored) || null)
        : null
      setSelectedId(keep ? keep.id : active ? active.id : null)
      return
    } catch {
      /* offline — keep cached selection */
    } finally {
      setLoading(false)
    }
  }, [storageKey, tenantId])

  // Reload when the tenant changes (and on first mount).
  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectYear = useCallback(
    (id: number | null) => {
      setSelectedId(id)
      if (id != null) localStorage.setItem(storageKey, String(id))
      else localStorage.removeItem(storageKey)
    },
    [storageKey],
  )

  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedId) || null,
    [years, selectedId],
  )
  const activeYear = useMemo(
    () => years.find((y) => y.isActive) || years.find((y) => y.status === 'active') || null,
    [years],
  )

  return (
    <FiscalYearContext.Provider
      value={{ years, selectedYear, activeYear, selectYear, loading, refresh }}
    >
      {children}
    </FiscalYearContext.Provider>
  )
}

export function useFiscalYear() {
  return useContext(FiscalYearContext)
}

/** True when the selected year is closed (read-only). */
export function useSelectedYearClosed(): boolean {
  const { selectedYear } = useFiscalYear()
  return selectedYear?.status === 'closed'
}