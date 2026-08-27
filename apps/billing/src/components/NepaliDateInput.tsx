import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { useCalendar } from '../lib/calendar'
import {
  adToBsString,
  bsMonthLength,
  bsToAdString,
  BS_MONTHS,
  todayBS,
} from '../lib/nepaliDate'

interface Props {
  value: string // always stored as AD ISO (YYYY-MM-DD)
  onChange: (adDate: string) => void
  label?: string
  required?: boolean
  className?: string
  /** Single-line variant for filter bars: BS entry via a text field
   * (YYYY-MM-DD), no preview line, tighter padding. */
  compact?: boolean
}

const BS_YEAR_MIN = 2000
const BS_YEAR_MAX = 2090

/**
 * Dual-calendar date input. Stores AD internally. In BS mode the user picks
 * a real Bikram Sambat date via year/month/day selects (a native date input
 * can't accept BS values — browsers only parse Gregorian). In AD mode it's
 * the standard browser date picker. The toggle converts the current date
 * between modes; the other calendar is always previewed underneath.
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
  const [inputMode, setInputMode] = useState<'AD' | 'BS'>(calendarType)
  const [bsText, setBsText] = useState('')
  const [bsInvalid, setBsInvalid] = useState(false)

  // Sync the entry mode when the global calendar setting changes.
  useEffect(() => setInputMode(calendarType), [calendarType])

  // Keep the compact BS text field in sync with the external AD value.
  useEffect(() => {
    setBsText(value ? adToBsString(value) : '')
    setBsInvalid(false)
  }, [value])

  // BS parts derived from the AD value
  const bs = useMemo(() => {
    if (!value) return null
    const raw = adToBsString(value)
    if (!raw) return null
    const [y, m, d] = raw.split('-').map(Number)
    return { year: y, month: m - 1, day: d }
  }, [value])

  const years = useMemo(
    () =>
      Array.from(
        { length: BS_YEAR_MAX - BS_YEAR_MIN + 1 },
        (_, i) => BS_YEAR_MIN + i,
      ),
    [],
  )

  const daysInMonth = useMemo(
    () => (bs ? bsMonthLength(bs.year, bs.month) : 32),
    [bs],
  )

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
    if (inputMode === 'BS') {
      // Raw comes as YYYY-MM-DD with 1-based month from the selects
      const ad = bsToAdString(raw)
      if (ad) onChange(ad)
    } else {
      onChange(raw)
    }
  }

  const toggleMode = () =>
    setInputMode((m) => (m === 'AD' ? 'BS' : 'AD'))

  const setToday = () => {
    if (inputMode === 'BS') {
      const ad = bsToAdString(todayBS())
      if (ad) onChange(ad)
    } else {
      onChange(new Date().toISOString().slice(0, 10))
    }
  }

  const selectCls = compact
    ? 'rounded border border-slate-300 bg-white py-1.5 pl-1.5 pr-5 text-xs outline-none focus:border-slate-500'
    : 'rounded border border-slate-300 bg-white py-2.5 pl-2 pr-7 text-sm outline-none focus:border-slate-500'

  // ── Compact variant: single-line, for filter bars ────────────────────
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {inputMode === 'BS' ? (
          <input
            type="text"
            value={bsText}
            placeholder="YYYY-MM-DD (BS)"
            onChange={(e) => {
              const raw = e.target.value
              setBsText(raw)
              const m = /^\d{4}-\d{2}-\d{2}$/.exec(raw.trim())
              const ad = m ? bsToAdString(raw.trim()) : ''
              if (ad) {
                setBsInvalid(false)
                onChange(ad)
              } else {
                setBsInvalid(raw.trim() !== '')
              }
            }}
            className={`w-32 rounded border px-2 py-1.5 text-xs outline-none focus:border-slate-500 ${
              bsInvalid ? 'border-red-400 bg-red-50' : 'border-slate-300'
            }`}
          />
        ) : (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={`rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-500`}
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
          <div className="flex flex-1 items-center gap-1.5">
            <select
              value={bs?.day ?? ''}
              onChange={(e) =>
                bs && setBs(bs.year, bs.month, Number(e.target.value))
              }
              className={`${selectCls} w-20`}
              aria-label="BS day"
            >
              {!bs && <option value="">Day</option>}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ),
              )}
            </select>
            <select
              value={bs?.month ?? ''}
              onChange={(e) =>
                bs && setBs(bs.year, Number(e.target.value), bs.day)
              }
              className={`${selectCls} flex-1`}
              aria-label="BS month"
            >
              {!bs && <option value="">Month</option>}
              {BS_MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={bs?.year ?? ''}
              onChange={(e) =>
                bs && setBs(Number(e.target.value), bs.month, bs.day)
              }
              className={`${selectCls} w-24`}
              aria-label="BS year"
            >
              {!bs && <option value="">Year</option>}
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
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
      </div>
      {value && (
        <div className="mt-0.5 pl-1">
          <span className="text-[11px] text-slate-400">
            {inputMode === 'BS'
              ? `AD: ${value}`
              : `BS: ${adToBsString(value)}`}
          </span>
        </div>
      )}
    </div>
  )
}
