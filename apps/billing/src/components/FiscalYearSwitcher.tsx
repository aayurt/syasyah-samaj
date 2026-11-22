import { CalendarClock, ChevronDown, Lock, Plus } from 'lucide-react'
import { useFiscalYear } from '../lib/fiscalYear'
import { useSyncState } from '../lib/offline'
import { useState, useEffect } from 'react'
import { useT, useLang } from '../lib/i18n'
import { toNepaliDigits } from '../lib/nepaliNumbers'
import AddFiscalYearModal from './AddFiscalYearModal'

/**
 * Fiscal year switcher with a floating "Add Year" modal button.
 */
export default function FiscalYearSwitcher() {
  const { years, selectedYear, activeYear, selectYear, refresh, loading } = useFiscalYear()
  const t = useT()
  const { lang } = useLang()
  const [showAddYear, setShowAddYear] = useState(false)

  // Clear cache + reload when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refresh])

  // Clear cache on window unload to prevent stale data
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof window !== 'undefined') {
        const current = Number(localStorage.getItem('billing.cacheVersion') || '0')
        localStorage.setItem('billing.cacheVersion', String(current + 1))
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // When "Add Year" is clicked, show modal to create fiscal year right in the header
  const handleAddYearClick = () => {
    setShowAddYear(true)
  }

  if (loading || years.length === 0) return null

  const isClosed = selectedYear?.status === 'closed'
  const isWorking = selectedYear?.id === activeYear?.id

  return (
    <>
      <div className="flex min-w-0 max-w-full items-center gap-1">
        <div className="relative min-w-0 max-w-full">
          <select
            value={selectedYear?.id ?? ''}
            onChange={(e) => {
              selectYear(e.target.value ? Number(e.target.value) : null)
              // Bump cache when switching years
              void refresh()
            }}
            className="min-w-[5rem] max-w-full appearance-none truncate rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
            title={t('fy.switchScope', 'Switch fiscal year — filters the data shown to this period')}
            data-testid="fiscal-year-select"
          >
            {years.map((y) => {
              const raw = (y.label || `FY ${String(y.startDate || '').slice(0, 10)}`).replace(/^(Fiscal\s+Year|FY|आ\.व\.)\s*/i, '').trim()
              const yearText = lang === 'ne' ? `आ.व. ${toNepaliDigits(raw)}` : `FY ${raw}`
              return (
                <option key={y.id} value={y.id}>
                  {yearText}
                  {y.status === 'closed' ? ` · ${t('status.closed', 'Closed')}` : ''}
                </option>
              )
            })}
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
        </div>
        <button
          onClick={handleAddYearClick}
          title={t('fy.addYear', 'Add new fiscal year')}
          className="shrink-0 rounded-full bg-crimson-600 p-1 text-white hover:bg-crimson-700 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        >
          <Plus size={14} />
        </button>
      </div>

      <AddFiscalYearModal
        isOpen={showAddYear}
        onClose={() => setShowAddYear(false)}
      />
    </>
  )
}
