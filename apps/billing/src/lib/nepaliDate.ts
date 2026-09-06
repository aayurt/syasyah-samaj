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
  // Date-only strings ("2025-07-17") parse as UTC midnight per the ES spec,
  // but NepaliDate reads *local* date parts — east of UTC that lands on the
  // right day, west of UTC it lands on the previous evening and shifts the BS
  // date back one. Force local midnight so every timezone sees the same
  // calendar day the string names.
  const d =
    typeof date === 'string'
      ? date.includes('T')
        ? new Date(date)
        : new Date(date + 'T00:00:00')
      : date
  const nep = new NepaliDate(d)
  return {
    year: nep.getYear(),
    month: nep.getMonth(),
    date: nep.getDate(),
    day: nep.getDay(),
  }
}

/**
 * Parse a date string, ensuring timestamps are treated as UTC so they
 * display in the user's local timezone. Plain date strings like
 * "2026-08-27" (no T) are left as-is for BS calendar conversion.
 */
function parseDate(dateStr: string): Date | null {
  const isTimestamp = dateStr.includes('T')
  let d: Date
  if (isTimestamp && !/[Zz]|[+-]\d{2}/.test(dateStr)) {
    // Timestamp without timezone suffix — append Z so browser interprets as UTC.
    d = new Date(dateStr + 'Z')
  } else if (!isTimestamp) {
    // Date-only string ("2025-07-17") — a calendar date, not an instant.
    // Default ES parsing makes it UTC midnight, which local getters then read
    // as the previous day west of UTC. Parse as local midnight instead.
    d = new Date(dateStr + 'T00:00:00')
  } else {
    d = new Date(dateStr)
  }
  return isNaN(d.getTime()) ? null : d
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

  const d = parseDate(dateStr)
  if (!d) return '—'

  // Use local-time methods — timestamps with Z are parsed as UTC above,
  // so getHours() etc. automatically convert to the user's timezone.
  const yr   = d.getFullYear()
  const mo   = d.getMonth()
  const dy   = d.getDate()
  const hrs  = d.getHours()
  const mins = d.getMinutes()

  // Date portion
  let formatted: string
  if (calendarType === 'BS') {
    // Convert the local calendar day to BS. Local midnight (not Date.UTC —
    // NepaliDate reads local parts, so a UTC base shifts west of UTC).
    const localDate = new Date(yr, mo, dy)
    const bs = toBS(localDate)
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
      .replace('YYYY', String(yr))
      .replace('YY', String(yr).slice(-2))
      .replace('MMMM', AD_MONTHS[mo])
      .replace('MMM', AD_MONTHS_SHORT[mo])
      .replace('MM', String(mo + 1).padStart(2, '0'))
      .replace('M', String(mo + 1))
      .replace('DD', String(dy).padStart(2, '0'))
      .replace('D', String(dy))
  }

  // Time (applies to both BS and AD)
  if (timeFormat === '12h') {
    const h12 = hrs % 12 || 12
    const ampm = hrs >= 12 ? 'PM' : 'AM'
    formatted = formatted
      .replace('HH', String(h12).padStart(2, '0'))
      .replace('H', String(h12))
      .replace('mm', String(mins).padStart(2, '0'))
      .replace('A', ampm)
  } else {
    formatted = formatted
      .replace('HH', String(hrs).padStart(2, '0'))
      .replace('H', String(hrs))
      .replace('mm', String(mins).padStart(2, '0'))
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

  const d = parseDate(dateStr)
  if (!d) return '—'

  const hours = d.getHours()
  const mins  = d.getMinutes()
  const m = String(mins).padStart(2, '0')

  if (timeFormat === '12h') {
    const h12 = hours % 12 || 12
    const ampm = hours >= 12 ? 'PM' : 'AM'
    return `${h12}:${m} ${ampm}`
  }
  return `${String(hours).padStart(2, '0')}:${m}`
}

/**
 * Get the current AD date as a local YYYY-MM-DD string.
 * (toISOString() is UTC — east of UTC before dawn it yields *yesterday*,
 * which defaulted new vouchers to the wrong day.)
 */
export function todayAD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Get the current BS date as a formatted string
 */
export function todayBS(): string {
  const bs = toBS(new Date())
  return `${bs.year}-${String(bs.month + 1).padStart(2, '0')}-${String(bs.date).padStart(2, '0')}`
}

/**
 * Convert BS year/month/date to an AD Date.
 * `bsMonth` is 0-based (0 = Baisakh). Uses toJsDate(), which returns *local*
 * midnight of the AD date (the library reads/writes local date parts), so
 * callers must not re-derive the date from the UTC ISO string.
 */
export function toAD(bsYear: number, bsMonth: number, bsDate: number): Date {
  const bs = new NepaliDate(
    `${bsYear}/${String(bsMonth + 1).padStart(2, '0')}/${String(bsDate).padStart(2, '0')}`,
  )
  return bs.toJsDate()
}

/** Number of days in a BS month (0-based month), derived from real calendar
 * data by diffing the first days of adjacent months. */
export function bsMonthLength(bsYear: number, bsMonth: number): number {
  const nextMonth = bsMonth === 11 ? 0 : bsMonth + 1
  const nextYear = bsMonth === 11 ? bsYear + 1 : bsYear
  const a = toAD(bsYear, bsMonth, 1)
  const b = toAD(nextYear, nextMonth, 1)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Convert a BS date string (YYYY-MM-DD) to an AD ISO date string.
 */
export function bsToAdString(bsStr: string): string {
  if (!bsStr) return ''
  const parts = bsStr.split('-')
  if (parts.length !== 3) return ''
  const bsYear = Number(parts[0])
  const bsMonth = Number(parts[1])
  const bsDay = Number(parts[2])
  // Reject impossible dates (month > 12, day beyond the month's length) so a
  // typo like 2082-04-33 flags the field red instead of the library silently
  // rolling it over into Bhadra 3 and storing a different day.
  if (!Number.isInteger(bsYear) || bsYear < 2000 || bsYear > 2090 || bsMonth < 1 || bsMonth > 12 || !Number.isInteger(bsDay) || bsDay < 1) return ''
  const len = bsMonthLength(bsYear, bsMonth - 1)
  if (len < 28 || bsDay > len) return ''
  let d: Date
  try {
    d = toAD(bsYear, bsMonth - 1, bsDay)
  } catch {
    return '' // year outside the library's supported range
  }
  // toAD() returns *local* midnight. Slicing the UTC ISO string here drops a
  // day in timezones east of UTC (NPT +5:45: local midnight is 18:15 UTC the
  // day before), which made typed BS dates store one day early — entering
  // 2082-04-01 (Shrawan 1) displayed back as 2082-03-32 (Asar 32). Read the
  // local date parts instead so the AD string matches the intended calendar
  // day in every timezone.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
