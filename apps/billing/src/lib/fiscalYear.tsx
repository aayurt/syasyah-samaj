import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, useSyncState } from './api'
import { useTenant, isParentCompany } from './tenant'
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
  const { tenantId, tenants } = useTenant()
  const { cacheVersion } = useSyncState()
  const [years, setYears] = useState<FiscalYear[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Fiscal years are owned by the parent company. A sub-company (illaka)
  // inherits its parent's fiscal years — there is one set of periods per
  // parent, not one per sub-company.
  const currentTenant = useMemo(() => tenants.find((t) => String(t.id) === String(tenantId)) || null, [tenants, tenantId])
  const fyTenantId = useMemo(() => {
    if (!currentTenant) return tenantId
    if (isParentCompany(currentTenant)) return tenantId
    return currentTenant.parentId || tenantId
  }, [currentTenant, tenantId])

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${fyTenantId}`, [fyTenantId])

  const refresh = useCallback(async () => {
    console.log('[fiscalYear] refresh triggered, fyTenantId:', fyTenantId)
    setLoading(true)
    try {
      // E2E bypass: return seeded mock fiscal years (no API round-trip,
      // no session cookie needed).
      if (typeof window !== 'undefined' && window.localStorage.getItem('__e2e_bypass__') === '1') {
        const mock: FiscalYear[] = [
          {
            id: 1,
            label: '2083-84',
            startDate: '2026-07-16',
            endDate: '2027-07-15',
            status: 'active',
            isActive: true,
            tenant: undefined,
          },
        ]
        setYears(mock)
        setSelectedId(mock[0].id)
        setLoading(false)
        return
      }
      const res = await api<{ docs: FiscalYear[] }>('/fiscal-years', {
        immediate: true,
        query: {
          limit: 100,
          depth: 0,
          sort: '-startDate',
          ...(fyTenantId ? { tenant: fyTenantId } : {}),
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
  }, [storageKey, tenantId, fyTenantId])

  // Reload when the tenant changes, on first mount, and whenever a sync
  // flush changed cached rows (e.g. a created fiscal year got its real
  // server id) so the list never keeps showing stale `local-*` ids.
  useEffect(() => {
    void refresh()
  }, [refresh, cacheVersion])

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

/**
 * Checks whether a given [startDate, endDate] range overlaps with any existing fiscal year.
 * Two date ranges [s1, e1] and [s2, e2] overlap if:
 * s1 <= e2 && e1 >= s2 (assuming valid intervals s1 <= e1, s2 <= e2).
 * Contiguous boundaries (e.g. e1 = 2026-07-15, s2 = 2026-07-16) do NOT overlap.
 */
export function findOverlappingFiscalYear(
  startDate: string,
  endDate: string,
  existingYears: FiscalYear[],
  excludeYearId?: string | number,
): FiscalYear | undefined {
  if (!startDate || !endDate) return undefined
  const s = String(startDate).slice(0, 10)
  const e = String(endDate).slice(0, 10)
  if (s > e) return undefined

  return existingYears.find((fy) => {
    if (excludeYearId && String(fy.id) === String(excludeYearId)) return false
    if (!fy.startDate || !fy.endDate) return false
    const fyStart = String(fy.startDate).slice(0, 10)
    const fyEnd = String(fy.endDate).slice(0, 10)
    return s <= fyEnd && e >= fyStart
  })
}
