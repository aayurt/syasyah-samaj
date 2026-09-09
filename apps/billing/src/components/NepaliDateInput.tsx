import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar } from '../lib/calendar'
import { useT } from '../lib/i18n'
import {
  adToBsString,
  bsMonthLength,
  bsToAdString,
  BS_MONTHS,
  toAD,
  toBS,
  todayAD,
  todayBS,
} from '../lib/nepaliDate'

interface Props {
  value: string // always stored as AD ISO (YYYY-MM-DD)
  onChange: (adDate: string) => void
  label?: string
  required?: boolean
  className?: string
  /** Single-line variant for filter bars: no label/preview line, tighter
   * padding. Same BS calendar popup as the full variant. */
  compact?: boolean
}

const BS_YEAR_MIN = 2000
const BS_YEAR_MAX = 2090

/**
 * Dual-calendar date input. Stores AD internally. In BS mode the user picks a
 * real Bikram Sambat date from a calendar popup (a native date input can't
 * accept BS values — browsers only parse Gregorian). In AD mode it's the
 * standard browser date picker. The toggle converts the current date between
 * modes; the other calendar is always previewed underneath (full variant).
 */
export default function NepaliDateInput({
  value,
  onChange,
  label,
  required,
  className = '',
  compact = false,
}: Props) {
  const { calendarType } = useCalendar()
  const t = useT()
  const [inputMode, setInputMode] = useState<'AD' | 'BS'>(calendarType)
  const [calOpen, setCalOpen] = useState(false)
  // The month shown in the BS calendar popup (0-based month).
  const [calYear, setCalYear] = useState(() => toBS(new Date()).year)
  const [calMonth, setCalMonth] = useState(() => toBS(new Date()).month)
  // Anchor for the fixed-position popup (viewport coords of the trigger).
  const [calPos, setCalPos] = useState<{ left: number; top: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Sync the entry mode when the global calendar setting changes.
  useEffect(() => setInputMode(calendarType), [calendarType])

  // BS parts derived from the AD value
  const bs = useMemo(() => {
    if (!value) return null
    const raw = adToBsString(value)
    if (!raw) return null
    const [y, m, d] = raw.split('-').map(Number)
    return { year: y, month: m - 1, day: d }
  }, [value])

  const setBs = (year: number, month: number, day: number) => {
    // Clamp the day when switching to a shorter month.
    const len = bsMonthLength(year, month)
    const d = Math.min(day, len)
    const ad = bsToAdString(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    )
    if (ad) onChange(ad)
  }

  const handleChange = (raw: string) => {
    if (!raw) {
      onChange('')
      return
    }
    onChange(raw)
  }

  const toggleMode = () =>
    setInputMode((m) => (m === 'AD' ? 'BS' : 'AD'))

  const setToday = () => {
    if (inputMode === 'BS') {
      const ad = bsToAdString(todayBS())
      if (ad) onChange(ad)
    } else {
      onChange(todayAD())
    }
  }

  const openCalendar = () => {
    // Open on the selected date's month (or today if nothing selected).
    const target = bs ?? (() => {
      const t = toBS(new Date())
      return { year: t.year, month: t.month }
    })()
    setCalYear(target.year)
    setCalMonth(target.month)
    // Anchor the popup to the trigger button in viewport coords so it can't
    // be clipped by an overflow container (filter bars, modals, tables).
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const POPUP_W = 288 // w-72
      const left = Math.min(r.left, Math.max(8, window.innerWidth - POPUP_W - 8))
      const top = r.bottom + 6
      setCalPos({ left, top })
    }
    setCalOpen(true)
  }

  // Close on outside click / Escape; re-anchor and stay in view on scroll/resize.
  useEffect(() => {
    if (!calOpen) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setCalOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalOpen(false)
    }
    const onScroll = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (r) {
        const POPUP_W = 288
        setCalPos({
          left: Math.min(r.left, Math.max(8, window.innerWidth - POPUP_W - 8)),
          top: r.bottom + 6,
        })
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [calOpen])

  const calCells = useMemo(() => {
    // Leading blanks to align the first day of the BS month (week starts Sun).
    const lead = toAD(calYear, calMonth, 1).getDay()
    const len = bsMonthLength(calYear, calMonth)
    const cells: (number | null)[] = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= len; d++) cells.push(d)
    return cells
  }, [calYear, calMonth])

  const today = useMemo(() => toBS(new Date()), [])

  const calMoveMonth = (delta: number) => {
    let m = calMonth + delta
    let y = calYear
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    if (y < BS_YEAR_MIN || y > BS_YEAR_MAX) return
    setCalMonth(m)
    setCalYear(y)
  }

  /** Shared BS calendar popup — rendered fixed so no ancestor clips it. */
  const bsCalendar = calOpen && calPos ? (
    <div
      className="fixed z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
      style={{ left: calPos.left, top: calPos.top }}
    >
      {/* Header: month/year navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => calMoveMonth(-1)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          title="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-sm font-semibold text-slate-800">
          {BS_MONTHS[calMonth]} {calYear}
        </div>
        <button
          type="button"
          onClick={() => calMoveMonth(1)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          title="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {/* Weekday header (week starts Sunday) */}
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-0.5">{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calCells.map((d, i) =>
          d === null ? (
            <div key={`b-${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              onClick={() => {
                setBs(calYear, calMonth, d)
                setCalOpen(false)
              }}
              className={`flex h-8 items-center justify-center rounded text-sm transition-colors ${
                bs?.year === calYear && bs?.month === calMonth && bs?.day === d
                  ? 'bg-red-700 font-semibold text-white'
                  : today.year === calYear && today.month === calMonth && today.date === d
                    ? 'bg-red-50 font-semibold text-red-700 ring-1 ring-red-200'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {d}
            </button>
          ),
        )}
      </div>
    </div>
  ) : null

  // ── Compact variant: single-line, for filter bars ────────────────────
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {inputMode === 'BS' ? (
          <div className="relative" ref={wrapRef}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (calOpen ? setCalOpen(false) : openCalendar())}
              className="flex w-36 items-center justify-between gap-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-slate-500"
            >
              <span className={bs ? 'text-slate-700' : 'text-slate-400'}>
                {bs
                  ? `${bs.day} ${BS_MONTHS[bs.month]} ${bs.year}`
                  : t('common.selectDate', 'Select date')}
              </span>
              <Calendar size={12} className="shrink-0 text-slate-400" />
            </button>
            {bsCalendar}
          </div>
        ) : (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-500"
          />
        )}
        <button
          type="button"
          onClick={toggleMode}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
          title={`Currently entering ${inputMode}. Click to switch.`}
        >
          {inputMode}
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        {inputMode === 'BS' ? (
          <div className="relative flex-1" ref={wrapRef}>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (calOpen ? setCalOpen(false) : openCalendar())}
              className="flex w-full items-center justify-between rounded border border-slate-300 bg-white py-2.5 pl-3 pr-3 text-sm outline-none focus:border-slate-500"
            >
              <span className={bs ? 'text-slate-800' : 'text-slate-400'}>
                {bs
                  ? `${bs.day} ${BS_MONTHS[bs.month]} ${bs.year}`
                  : 'Select BS date'}
              </span>
              <Calendar size={14} className="text-slate-400" />
            </button>
            {bsCalendar}
          </div>
        ) : (
          <div className="relative flex-1">
            <Calendar
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="date"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full rounded border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        )}
        <button
          type="button"
          onClick={toggleMode}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
          title={`Currently entering ${inputMode} date. Click to switch.`}
        >
          {inputMode}
        </button>
        <button
          type="button"
          onClick={setToday}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
          title="Set to today"
        >
          Today
        </button>
        {value && (
          <span className="shrink-0 text-[11px] text-slate-400">
            {inputMode === 'BS'
              ? `AD: ${value}`
              : `BS: ${adToBsString(value)}`}
          </span>
        )}
      </div>
    </div>
  )
}