import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { useCalendar } from '../lib/calendar'
import { adToBsString, bsToAdString, toBS } from '../lib/nepaliDate'

interface Props {
  value: string // always stored as AD ISO (YYYY-MM-DD)
  onChange: (adDate: string) => void
  label?: string
  required?: boolean
  className?: string
}

/**
 * Dual-calendar date input. Stores AD internally, shows BS or AD
 * depending on the global calendar setting. Includes a toggle to
 * switch the input mode — changing mode converts the displayed value.
 */
export default function NepaliDateInput({
  value,
  onChange,
  label,
  required,
  className = '',
}: Props) {
  const { calendarType } = useCalendar()
  const [inputMode, setInputMode] = useState<'AD' | 'BS'>(calendarType)

  // The value shown in the input depends on the mode
  const displayValue = useMemo(() => {
    if (!value) return ''
    if (inputMode === 'BS') return adToBsString(value)
    return value
  }, [value, inputMode])

  // Preview: show the "other" calendar
  const preview = useMemo(() => {
    if (!value) return null
    if (inputMode === 'BS') {
      // Show AD below
      return <span className="text-[11px] text-slate-400">AD: {value}</span>
    }
    // Show BS below
    const bs = toBS(value)
    return <span className="text-[11px] text-slate-400">BS: {bs.year}-{String(bs.month + 1).padStart(2, '0')}-{String(bs.date).padStart(2, '0')}</span>
  }, [value, inputMode])

  const handleChange = (raw: string) => {
    if (!raw) { onChange(''); return }
    if (inputMode === 'BS') {
      // Convert BS input to AD
      const ad = bsToAdString(raw)
      if (ad) onChange(ad)
    } else {
      // Already AD
      onChange(raw)
    }
  }

  const toggleMode = () => {
    // Switch mode but keep the same underlying AD date
    setInputMode((m) => m === 'AD' ? 'BS' : 'AD')
  }

  return (
    <div className={className}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100"
          title={`Currently entering ${inputMode} date. Click to switch.`}
        >
          {inputMode}
        </button>
      </div>
      {preview && <div className="mt-0.5 pl-1">{preview}</div>}
    </div>
  )
}
