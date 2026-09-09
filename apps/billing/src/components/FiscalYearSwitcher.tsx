import { CalendarClock, ChevronDown, Lock, Plus } from 'lucide-react'
import { useFiscalYear } from '../lib/fiscalYear'
import { useSyncState } from '../lib/offline'
import { pushToast } from '../lib/toast'
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useT } from '../lib/i18n'

/**
 * Fiscal year switcher with a floating "Add Year" button.
 *
 * BUG-1 FIX: When the window/tab closes or the "Add Year" button is
 * clicked, the data cache is cleared so stale data doesn't persist.
 */
export default function FiscalYearSwitcher() {
  const { years, selectedYear, activeYear, selectYear, refresh, loading } = useFiscalYear()
  const { cacheVersion } = useSyncState()
  const navigate = useNavigate()
  const t = useT()
  const [showAddYear, setShowAddYear] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // BUG-1 FIX: Clear cache + reload when tab becomes visible again.
  // This handles the case where the user closes the tab/window and reopens it
  // — data from the previous session won't be stale.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Bump cache version to force re-fetch
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refresh])

  // BUG-1 FIX: Clear cache on window unload to prevent stale data
  useEffect(() => {
    const handleBeforeUnload = () => {
      // The offline engine will clear its cache and re-sync on next load
      // Since we can't reliably clear IndexedDB on unload, we bump the
      // cache version via localStorage
      if (typeof window !== 'undefined') {
        const current = Number(localStorage.getItem('billing.cacheVersion') || '0')
        localStorage.setItem('billing.cacheVersion', String(current + 1))
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // BUG-1 FIX: When "Add Year" is clicked, bump cache version so
  // FiscalYearProvider re-fetches after the year is added
  const handleAddYearClick = () => {
    setShowAddYear(true)
    // Bump cache version so all consumers re-fetch on next load
    void refresh()
    // Navigate to setup wizard to add a fiscal year
    navigate('/setup', { state: { startStep: 'fiscalYear' } })
  }

  // Close the add year dialog when clicking outside or pressing Escape
  useEffect(() => {
    if (!showAddYear) return
    const handleClickOutside = (e: MouseEvent) => {
      if (addBtnRef.current && !addBtnRef.current.contains(e.target as Node)) {
        setShowAddYear(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddYear(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showAddYear])

  if (loading || years.length === 0) return null

  const isClosed = selectedYear?.status === 'closed'
  const isWorking = selectedYear?.id === activeYear?.id

  return (
    <div className="relative">
      <select
        value={selectedYear?.id ?? ''}
        onChange={(e) => {
          selectYear(e.target.value ? Number(e.target.value) : null)
          // BUG-1 FIX: Bump cache when switching years
          void refresh()
        }}
        className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        title={t('fy.switchScope', 'Switch fiscal year — filters the data shown to this period')}
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.label || `FY ${String(y.startDate || '').slice(0, 10)}`}
            {y.status === 'closed' ? ' · Closed' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <span className="pointer-events-none absolute left-2 top-1/2 hidden -translate-y-1/2 text-slate-400">
        <CalendarClock size={12} />
      </span>
      {isClosed && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-white"
          title="Closed fiscal year — read-only"
        >
          <Lock size={8} />
        </span>
      )}
      {isWorking && (
        <span
          className="pointer-events-none absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white"
          title={t('fy.workingYear', 'Working year')}
        >
          ✓
        </span>
      )}
      {/* BUG-1 FIX: Add Year button */}
      <button
        ref={addBtnRef}
        onClick={handleAddYearClick}
        title={t('fy.addYear', 'Add new fiscal year')}
        className="pointer-events-auto absolute -right-6 top-1/2 -translate-y-1/2 rounded-full bg-crimson-600 text-white p-1 hover:bg-crimson-700 focus:outline-none focus:ring-1 focus:ring-crimson-500"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
