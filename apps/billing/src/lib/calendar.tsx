import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { formatDate as rawFormatDate, formatTime as rawFormatTime } from './nepaliDate'

interface CalendarSettings {
  calendarType: 'AD' | 'BS'
  dateFormat: string
  timeFormat: '12h' | '24h'
}

interface CalendarCtx extends CalendarSettings {
  formatDate: (dateStr: string | null | undefined) => string
  formatDateTime: (dateStr: string | null | undefined) => string
  formatTime: (dateStr: string | null | undefined) => string
  /** Push a new calendar setting to the app immediately (after a save). */
  update: (partial: Partial<CalendarSettings>) => void
}

const STORAGE_KEY = 'billing.calendar'

const DEFAULTS: CalendarSettings = {
  calendarType: 'BS',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '12h',
}

function loadCached(): CalendarSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CalendarSettings>
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULTS
}

function persist(s: CalendarSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

const CalendarContext = createContext<CalendarCtx>({
  ...DEFAULTS,
  formatDate: (d) => rawFormatDate(d, DEFAULTS.calendarType, DEFAULTS.dateFormat),
  formatDateTime: (d) => rawFormatDate(d, DEFAULTS.calendarType, 'YYYY-MM-DD HH:mm', DEFAULTS.timeFormat),
  formatTime: (d) => rawFormatTime(d, DEFAULTS.timeFormat),
  update: () => {},
})

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  // Start from localStorage so BS dates are immediate on page load
  const [cal, setCal] = useState<CalendarSettings>(loadCached)

  useEffect(() => {
    let alive = true
    api<{ calendarType?: string; dateFormat?: string; timeFormat?: string }>(
      '/globals/billing-settings',
      { query: { depth: 0 } },
    )
      .then((r) => {
        if (!alive) return
        const next: CalendarSettings = {
          calendarType: (r.calendarType as 'AD' | 'BS') || 'BS',
          dateFormat: r.dateFormat || 'YYYY-MM-DD',
          timeFormat: (r.timeFormat as '12h' | '24h') || '12h',
        }
        setCal(next)
        persist(next)
      })
      .catch(() => {
        /* use cached or defaults */
      })
    return () => { alive = false }
  }, [])

  const fmtDate = useCallback(
    (d: string | null | undefined) => rawFormatDate(d, cal.calendarType, cal.dateFormat),
    [cal.calendarType, cal.dateFormat],
  )

  const fmtDateTime = useCallback(
    (d: string | null | undefined) => {
      const suffix = cal.timeFormat === '12h' ? ' HH:mm A' : ' HH:mm'
      return rawFormatDate(d, cal.calendarType, cal.dateFormat + suffix, cal.timeFormat)
    },
    [cal.calendarType, cal.dateFormat, cal.timeFormat],
  )

  const fmtTime = useCallback(
    (d: string | null | undefined) => rawFormatTime(d, cal.timeFormat),
    [cal.timeFormat],
  )

  const update = useCallback((partial: Partial<CalendarSettings>) => {
    setCal((c) => {
      const next = { ...c, ...partial }
      persist(next)
      return next
    })
  }, [])

  return (
    <CalendarContext.Provider
      value={{ ...cal, formatDate: fmtDate, formatDateTime: fmtDateTime, formatTime: fmtTime, update }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  return useContext(CalendarContext)
}
