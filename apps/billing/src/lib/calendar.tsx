import { createContext, useContext, useEffect, useState } from 'react'
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

const DEFAULTS: CalendarSettings = {
  calendarType: 'BS',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '12h',
}

const CalendarContext = createContext<CalendarCtx>({
  ...DEFAULTS,
  formatDate: (d) => rawFormatDate(d, DEFAULTS.calendarType, DEFAULTS.dateFormat),
  formatDateTime: (d) => rawFormatDate(d, DEFAULTS.calendarType, 'YYYY-MM-DD HH:mm', DEFAULTS.timeFormat),
  formatTime: (d) => rawFormatTime(d, DEFAULTS.timeFormat),
  update: () => {},
})

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [cal, setCal] = useState<CalendarSettings>(DEFAULTS)

  useEffect(() => {
    let alive = true
    api<{ calendarType?: string; dateFormat?: string; timeFormat?: string }>(
      '/globals/billing-settings',
      { query: { depth: 0 } },
    )
      .then((r) => {
        if (!alive) return
        setCal({
          calendarType: (r.calendarType as 'AD' | 'BS') || 'BS',
          dateFormat: r.dateFormat || 'YYYY-MM-DD',
          timeFormat: (r.timeFormat as '12h' | '24h') || '12h',
        })
      })
      .catch(() => {
        /* use defaults */
      })
    return () => {
      alive = false
    }
  }, [])

  const fmtDate = (d: string | null | undefined) =>
    rawFormatDate(d, cal.calendarType, cal.dateFormat)

  const fmtDateTime = (d: string | null | undefined) =>
    rawFormatDate(d, cal.calendarType, cal.dateFormat + ' HH:mm', cal.timeFormat)

  const fmtTime = (d: string | null | undefined) =>
    rawFormatTime(d, cal.timeFormat)

  const update = (partial: Partial<CalendarSettings>) =>
    setCal((c) => ({ ...c, ...partial }))

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
