import { CalendarClock, ChevronDown, Lock } from 'lucide-react'
import { useFiscalYear } from '../lib/fiscalYear'

/**
 * Fiscal year switcher in the app header. Shows the selected (working)
 * year and lets the user switch between fiscal years — the selection
 * filters the vouchers/journal/reports to that period. Closed years show
 * a lock and are viewable but read-only (the server enforces this).
 */
export default function FiscalYearSwitcher() {
  const { years, selectedYear, activeYear, selectYear, loading } = useFiscalYear()

  if (loading || years.length === 0) return null

  const label = selectedYear?.label || selectedYear?.startDate || 'FY'
  const isClosed = selectedYear?.status === 'closed'
  const isWorking = selectedYear?.id === activeYear?.id

  return (
    <div className="relative">
      <select
        value={selectedYear?.id ?? ''}
        onChange={(e) => selectYear(e.target.value ? Number(e.target.value) : null)}
        className="appearance-none rounded border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-crimson-500 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        title="Switch fiscal year — filters the data shown to this period"
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
          title="Working year"
        >
          ✓
        </span>
      )}
    </div>
  )
}