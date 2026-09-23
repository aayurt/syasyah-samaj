import { Locale } from './homeTranslations'

const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export function toLocalizedNumber(
  val: number | string,
  locale: Locale = 'en',
): string {
  const str = String(val)
  if (locale === 'en') {
    // Replace any Devanagari digits with Western digits
    return str.replace(/[०-९]/g, (d) => String(devanagariDigits.indexOf(d)))
  }

  // For 'ne' and 'new': replace Western digits 0-9 with Devanagari ०-९
  return str.replace(/[0-9]/g, (d) => devanagariDigits[Number(d)] || d)
}
