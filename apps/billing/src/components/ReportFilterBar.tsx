import { useMemo, useCallback } from 'react'
import { Calendar, RotateCcw, ChevronDown } from 'lucide-react'
import { useFiscalYear } from '../lib/fiscalYear'
import { useCalendar } from '../lib/calendar'
import { useT } from '../lib/i18n'
import NepaliDateInput from './NepaliDateInput'
import {
  toBS,
  toAD,
  bsMonthLength,
  todayAD,
  BS_MONTHS,
} from '../lib/nepaliDate'
import type { FiscalYear } from '../lib/types'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getYesterdayAD(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalDateString(d)
}

export interface ReportFilterBarProps {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onFilterChange?: (from: string, to: string) => void
  asOfOnly?: boolean
  className?: string
  extraControls?: React.ReactNode
}

export default function ReportFilterBar({
  from,
  to,
  onFromChange,
  onToChange,
  onFilterChange,
  asOfOnly = false,
  className = '',
  extraControls,
}: ReportFilterBarProps) {
  const t = useT()
  const { years, selectedYear, activeYear, selectYear } = useFiscalYear()
  const { calendarType } = useCalendar()

  // Base BS start year for month & quarter ranges
  const fyBsStartYear = useMemo(() => {
    if (selectedYear?.startDate) {
      const bs = toBS(selectedYear.startDate)
      if (bs.year > 0) return bs.year
    }
    const todayBs = toBS(todayAD())
    // If before Shrawan (months 0-2: Baisakh, Jestha, Asar), FY started in previous BS year
    return todayBs.month < 3 ? todayBs.year - 1 : todayBs.year
  }, [selectedYear])

  // 12 BS months in Nepali fiscal year order: Shrawan (3) to Asar (2)
  const fyMonths = useMemo(() => {
    const list = [
      { name: BS_MONTHS[3], monthIdx: 3, year: fyBsStartYear },
      { name: BS_MONTHS[4], monthIdx: 4, year: fyBsStartYear },
      { name: BS_MONTHS[5], monthIdx: 5, year: fyBsStartYear },
      { name: BS_MONTHS[6], monthIdx: 6, year: fyBsStartYear },
      { name: BS_MONTHS[7], monthIdx: 7, year: fyBsStartYear },
      { name: BS_MONTHS[8], monthIdx: 8, year: fyBsStartYear },
      { name: BS_MONTHS[9], monthIdx: 9, year: fyBsStartYear },
      { name: BS_MONTHS[10], monthIdx: 10, year: fyBsStartYear },
      { name: BS_MONTHS[11], monthIdx: 11, year: fyBsStartYear },
      { name: BS_MONTHS[0], monthIdx: 0, year: fyBsStartYear + 1 },
      { name: BS_MONTHS[1], monthIdx: 1, year: fyBsStartYear + 1 },
      { name: BS_MONTHS[2], monthIdx: 2, year: fyBsStartYear + 1 },
    ]
    return list.map((m) => {
      const len = bsMonthLength(m.year, m.monthIdx)
      const startDate = toLocalDateString(toAD(m.year, m.monthIdx, 1))
      const endDate = toLocalDateString(toAD(m.year, m.monthIdx, len))
      return {
        ...m,
        startDate,
        endDate,
      }
    })
  }, [fyBsStartYear])

  // Quarters
  const quarters = useMemo(() => {
    return [
      {
        label: 'Q1',
        name: 'Q1 (Shr - Ash)',
        from: toLocalDateString(toAD(fyBsStartYear, 3, 1)),
        to: toLocalDateString(toAD(fyBsStartYear, 5, bsMonthLength(fyBsStartYear, 5))),
      },
      {
        label: 'Q2',
        name: 'Q2 (Kar - Pou)',
        from: toLocalDateString(toAD(fyBsStartYear, 6, 1)),
        to: toLocalDateString(toAD(fyBsStartYear, 8, bsMonthLength(fyBsStartYear, 8))),
      },
      {
        label: 'Q3',
        name: 'Q3 (Mag - Chi)',
        from: toLocalDateString(toAD(fyBsStartYear, 9, 1)),
        to: toLocalDateString(toAD(fyBsStartYear, 11, bsMonthLength(fyBsStartYear, 11))),
      },
      {
        label: 'Q4',
        name: 'Q4 (Bai - Asa)',
        from: toLocalDateString(toAD(fyBsStartYear + 1, 0, 1)),
        to: toLocalDateString(toAD(fyBsStartYear + 1, 2, bsMonthLength(fyBsStartYear + 1, 2))),
      },
    ]
  }, [fyBsStartYear])

  // Current BS month & last BS month
  const { thisMonthRange, lastMonthRange } = useMemo(() => {
    const bsToday = toBS(todayAD())
    const thisStart = toLocalDateString(toAD(bsToday.year, bsToday.month, 1))
    const thisEnd = toLocalDateString(toAD(bsToday.year, bsToday.month, bsMonthLength(bsToday.year, bsToday.month)))

    const prevMonthIdx = bsToday.month === 0 ? 11 : bsToday.month - 1
    const prevMonthYear = bsToday.month === 0 ? bsToday.year - 1 : bsToday.year
    const lastStart = toLocalDateString(toAD(prevMonthYear, prevMonthIdx, 1))
    const lastEnd = toLocalDateString(toAD(prevMonthYear, prevMonthIdx, bsMonthLength(prevMonthYear, prevMonthIdx)))

    return {
      thisMonthRange: { from: thisStart, to: thisEnd },
      lastMonthRange: { from: lastStart, to: lastEnd },
    }
  }, [])

  const setRange = useCallback((newFrom: string, newTo: string) => {
    onFromChange(newFrom)
    onToChange(newTo)
    if (onFilterChange) onFilterChange(newFrom, newTo)
  }, [onFromChange, onToChange, onFilterChange])

  // Handle FY dropdown selection
  const handleFiscalYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) {
      setRange('', '')
      return
    }
    const fyId = Number(val)
    const matched = years.find((y) => y.id === fyId)
    if (matched) {
      selectYear(matched.id)
      setRange(matched.startDate || '', matched.endDate || '')
    }
  }

  // Handle Month dropdown selection
  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    const [start, end] = val.split(':')
    if (start && end) {
      setRange(start, end)
    }
  }

  // Reset to active fiscal year or clear
  const handleReset = () => {
    const target = activeYear || selectedYear
    if (target?.startDate && target?.endDate) {
      setRange(target.startDate, target.endDate)
    } else {
      setRange('', '')
    }
  }

  // Active shortcut pill detection
  const today = todayAD()
  const yesterday = getYesterdayAD()
  const activePill = useMemo(() => {
    if (!from && !to) return 'all'
    if (from === today && to === today) return 'today'
    if (from === yesterday && to === yesterday) return 'yesterday'
    if (from === thisMonthRange.from && to === thisMonthRange.to) return 'thisMonth'
    if (from === lastMonthRange.from && to === lastMonthRange.to) return 'lastMonth'
    for (const q of quarters) {
      if (from === q.from && to === q.to) return q.label
    }
    if (selectedYear && from === selectedYear.startDate && to === selectedYear.endDate) return 'fullFY'
    return null
  }, [from, to, today, yesterday, thisMonthRange, lastMonthRange, quarters, selectedYear])

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-xs ${className}`}>
      {/* ── Top row: Fiscal Year, Month Picker, Day Presets, Extra Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Fiscal Year Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">{t('reports.fiscalYear', 'Fiscal Year')}:</span>
            <select
              aria-label={t('reports.fiscalYear', 'Fiscal Year')}
              value={selectedYear?.id ?? ''}
              onChange={handleFiscalYearSelect}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label} {y.isActive ? `(${t('common.active', 'Active')})` : ''}
                </option>
              ))}
              <option value="">{t('reports.allPeriods', 'All Periods')}</option>
            </select>
          </div>

          {/* Month Selector */}
          {!asOfOnly && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">{t('reports.month', 'Month')}:</span>
              <select
                aria-label={t('reports.month', 'Month')}
                value={
                  fyMonths.find((m) => m.startDate === from && m.endDate === to)
                    ? `${from}:${to}`
                    : ''
                }
                onChange={handleMonthSelect}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="">{t('reports.selectMonth', 'Select Month…')}</option>
                {fyMonths.map((m) => (
                  <option key={m.name} value={`${m.startDate}:${m.endDate}`}>
                    {m.name} ({m.year})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Extra Custom Controls (e.g. search, status dropdown) */}
          {extraControls}
        </div>

        {/* Reset / Clear Button */}
        <button
          type="button"
          onClick={handleReset}
          title={t('reports.resetFilters', 'Reset to Fiscal Year')}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <RotateCcw size={12} />
          <span>{t('common.reset', 'Reset')}</span>
        </button>
      </div>

      {/* ── Middle row: Quick Pills (Today, Yesterday, Quarters, Full FY, All) ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {t('reports.period', 'Period')}:
        </span>

        {/* Day Pills */}
        <button
          type="button"
          onClick={() => setRange(today, today)}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            activePill === 'today'
              ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t('reports.today', 'Today')}
        </button>

        <button
          type="button"
          onClick={() => setRange(yesterday, yesterday)}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            activePill === 'yesterday'
              ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t('reports.yesterday', 'Yesterday')}
        </button>

        {!asOfOnly && (
          <>
            <button
              type="button"
              onClick={() => setRange(thisMonthRange.from, thisMonthRange.to)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                activePill === 'thisMonth'
                  ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('reports.thisMonth', 'This Month')}
            </button>

            <button
              type="button"
              onClick={() => setRange(lastMonthRange.from, lastMonthRange.to)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                activePill === 'lastMonth'
                  ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('reports.lastMonth', 'Last Month')}
            </button>

            {/* Quarters Q1 - Q4 */}
            {quarters.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setRange(q.from, q.to)}
                title={q.name}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  activePill === q.label
                    ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {q.label}
              </button>
            ))}
          </>
        )}

        {/* Full FY */}
        {selectedYear && (
          <button
            type="button"
            onClick={() => setRange(selectedYear.startDate || '', selectedYear.endDate || '')}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              activePill === 'fullFY'
                ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('reports.fullFY', 'Full FY')} ({selectedYear.label})
          </button>
        )}

        {/* All Time */}
        <button
          type="button"
          onClick={() => setRange('', '')}
          className={`rounded-md px-2 py-1 text-xs transition-colors ${
            activePill === 'all'
              ? 'border border-blue-400 bg-blue-50 font-semibold text-blue-700'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t('reports.allTime', 'All Time')}
        </button>
      </div>

      {/* ── Bottom row: Dual Date Pickers (From / To) with NepaliDateInput ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
        {!asOfOnly ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">{t('reports.from', 'From')}:</span>
              <NepaliDateInput compact value={from} onChange={onFromChange} />
            </div>
            <span className="text-slate-400">→</span>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">{t('reports.to', 'To')}:</span>
              <NepaliDateInput compact value={to} onChange={onToChange} />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500">{t('reports.asOfDate', 'As of Date')}:</span>
            <NepaliDateInput compact value={to || today} onChange={onToChange} />
          </div>
        )}
      </div>
    </div>
  )
}
