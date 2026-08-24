import NepaliDate from 'nepali-date-converter'

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan',
  'Bhadra', 'Aswin', 'Kartik', 'Mangsir',
  'Poush', 'Magh', 'Falgun', 'Chaitra',
]

const BS_MONTHS_SHORT = [
  'Bai', 'Jes', 'Asa', 'Shr',
  'Bha', 'Ash', 'Kar', 'Man',
  'Pou', 'Mag', 'Fal', 'Chi',
]

const AD_MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]

const AD_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Convert an ISO date string or Date to BS { year, month, date, day }
 */
export function toBS(date: string | Date): { year: number; month: number; date: number; day: number } {
  const d = typeof date === 'string' ? new Date(date) : date
  const nep = new NepaliDate(d)
  return {
    year: nep.getYear(),
    month: nep.getMonth(),
    date: nep.getDate(),
    day: nep.getDay(),
  }
}

/**
 * Format a date according to the calendar setting
 */
export function formatDate(
  dateStr: string | null | undefined,
  calendarType: 'AD' | 'BS',
  dateFormat: string,
  timeFormat: '12h' | '24h' = '12h',
): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'

  // Date portion
  let formatted: string
  if (calendarType === 'BS') {
    const bs = toBS(d)
    const monthNames = BS_MONTHS
    const monthShort = BS_MONTHS_SHORT
    formatted = dateFormat
      .replace('YYYY', String(bs.year))
      .replace('YY', String(bs.year).slice(-2))
      .replace('MMMM', monthNames[bs.month])
      .replace('MMM', monthShort[bs.month])
      .replace('MM', String(bs.month + 1).padStart(2, '0'))
      .replace('M', String(bs.month + 1))
      .replace('DD', String(bs.date).padStart(2, '0'))
      .replace('D', String(bs.date))
  } else {
    formatted = dateFormat
      .replace('YYYY', String(d.getFullYear()))
      .replace('YY', String(d.getFullYear()).slice(-2))
      .replace('MMMM', AD_MONTHS[d.getMonth()])
      .replace('MMM', AD_MONTHS_SHORT[d.getMonth()])
      .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
      .replace('M', String(d.getMonth() + 1))
      .replace('DD', String(d.getDate()).padStart(2, '0'))
      .replace('D', String(d.getDate()))
  }

  // Time (applies to both BS and AD)
  const hours = d.getHours()
  if (timeFormat === '12h') {
    const h12 = hours % 12 || 12
    const ampm = hours >= 12 ? 'PM' : 'AM'
    formatted = formatted
      .replace('HH', String(h12).padStart(2, '0'))
      .replace('H', String(h12))
      .replace('mm', String(d.getMinutes()).padStart(2, '0'))
      .replace('A', ampm)
  } else {
    formatted = formatted
      .replace('HH', String(hours).padStart(2, '0'))
      .replace('H', String(hours))
      .replace('mm', String(d.getMinutes()).padStart(2, '0'))
      .replace('A', '')
  }

  return formatted.trim()
}

/**
 * Format just the time
 */
export function formatTime(
  dateStr: string | null | undefined,
  timeFormat: '12h' | '24h' = '12h',
): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'

  const hours = d.getHours()
  const mins = String(d.getMinutes()).padStart(2, '0')

  if (timeFormat === '12h') {
    const h12 = hours % 12 || 12
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${h12}:${mins} ${ampm}`
  }
  return `${String(hours).padStart(2, '0')}:${mins}`
}

/**
 * Get the current BS date as a formatted string
 */
export function todayBS(): string {
  const bs = toBS(new Date())
  return `${bs.year}-${String(bs.month + 1).padStart(2, '0')}-${String(bs.date).padStart(2, '0')}`
}

/**
 * Convert BS year/month/date to an AD Date object.
 * Uses the library's BS→AD conversion by parsing a BS string.
 */
export function toAD(bsYear: number, bsMonth: number, bsDate: number): Date {
  const bs = new NepaliDate(`${bsYear}/${String(bsMonth + 1).padStart(2, '0')}/${String(bsDate).padStart(2, '0')}`)
  return new Date(bs.toString())
}

/**
 * Convert a BS date string (YYYY-MM-DD) to an AD ISO date string.
 */
export function bsToAdString(bsStr: string): string {
  if (!bsStr) return ''
  const parts = bsStr.split('-')
  if (parts.length !== 3) return ''
  const d = toAD(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return d.toISOString().slice(0, 10)
}

/**
 * Convert an AD ISO date string to a BS date string (YYYY-MM-DD).
 */
export function adToBsString(adStr: string): string {
  if (!adStr) return ''
  const bs = toBS(adStr)
  return `${bs.year}-${String(bs.month + 1).padStart(2, '0')}-${String(bs.date).padStart(2, '0')}`
}

/** Number of days in each BS month (approx — standard calendar) */
export const BS_MONTH_DAYS = [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30]

export { BS_MONTHS, BS_MONTHS_SHORT, AD_MONTHS, AD_MONTHS_SHORT }
