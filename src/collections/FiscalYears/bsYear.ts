/**
 * Fiscal year label helpers — library-free server-side fallback.
 *
 * The SPA (apps/billing) has `nepali-date-converter` and sends the proper
 * BS label (e.g. "2083-84") in the request body. The server only falls back
 * to an AD-year label when the client didn't supply one.
 */
export function adYearLabel(adDate: string | Date): string {
  const d = typeof adDate === 'string' ? new Date(adDate) : adDate
  if (isNaN(d.getTime())) return ''
  const yr = d.getFullYear()
  return `${yr}-${String((yr + 1) % 100).padStart(2, '0')}`
}