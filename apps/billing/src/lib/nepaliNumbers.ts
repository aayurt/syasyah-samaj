/**
 * Nepali digit + amount helpers for the billing SPA.
 *
 * - toNepaliDigits(): map Western digits 0-9 → Devanagari ०-९ (U+0966..U+096F).
 * - numberToNepaliWords(): amounts in Nepali words (lakh/crore system),
 *   e.g. 115538.50 → 'एक लाख पन्ध्र हजार पाँच सय अठ्ठासी रूपैयाँ पचास पैसा'.
 * - formatNepaliAmount(): Indian-style grouping (11,55,538) with Nepali digits.
 *
 * Pure functions, no imports — safe to use from api.ts (fmt) and components.
 */

const NE_DIGITS = '०१२३४५६७८९' // U+0966 (०) .. U+096F (९)

/** Map Western digits 0-9 → Devanagari ०-९. Non-digit characters pass through. */
export function toNepaliDigits(s: string): string {
  return (s || '').replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)])
}

/* ── Nepali amount-in-words ────────────────────────────────────────────── */
// Words for 0-99 (Nepali has distinct words up to 99, then सय/हजार/लाख/करोड).
const NE_ONES = [
  'शून्य', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ',
  'दश', 'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस',
  'बीस', 'एक्काइस', 'बाइस', 'तेइस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताइस', 'अठ्ठाइस', 'उनन्तीस',
  'तीस', 'एकतीस', 'बत्तीस', 'तेत्तीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड्तीस', 'उनन्चालीस',
  'चालीस', 'एकचालीस', 'बियालीस', 'त्रिचालीस', 'चौवालीस', 'पैंतालीस', 'छयालीस', 'सच्चालीस', 'अड्चालीस', 'उनन्चास',
  'पचास', 'एकाउन्न', 'बाउन्न', 'त्रिपन्न', 'चौवन्न', 'पचपन्न', 'छपन्न', 'सन्ताउन्न', 'अन्ठाउन्न', 'उनन्साठी',
  'साठी', 'एकसठ्ठी', 'बैसठ्ठी', 'त्रिसठ्ठी', 'चौंसठ्ठी', 'पैंसठ्ठी', 'छयसठ्ठी', 'सत्सठ्ठी', 'अठ्सठ्ठी', 'उनन्सत्तरी',
  'सत्तरी', 'एकहत्तर', 'बहत्तर', 'त्रिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'असी', 'एकासी', 'बयासी', 'त्रियासी', 'चौरासी', 'पचासी', 'छयासी', 'सतासी', 'अठ्ठासी', 'उनन्नब्बे',
  'नब्बे', 'एकानब्बे', 'बयानब्बे', 'त्रियानब्बे', 'चौरानब्बे', 'पचानब्बे', 'छयानब्बे', 'सन्तानब्बे', 'अन्ठानब्बे', 'उनान्सय',
]

// Sane cap: 9,99,99,99,99,999 (9999 करोड) — far above any voucher. Beyond it
// we fall back to formatted digits instead of nonsense words.
const MAX_WORDS = 99999999999

/** Integer (0..MAX_WORDS) → Nepali words. Empty string for 0 (caller handles). */
function intToNepaliWords(n: number): string {
  if (n >= 10000000) {
    const rest = n % 10000000
    return intToNepaliWords(Math.floor(n / 10000000)) + ' करोड' + (rest ? ' ' + intToNepaliWords(rest) : '')
  }
  if (n >= 100000) {
    const rest = n % 100000
    return intToNepaliWords(Math.floor(n / 100000)) + ' लाख' + (rest ? ' ' + intToNepaliWords(rest) : '')
  }
  if (n >= 1000) {
    const rest = n % 1000
    return intToNepaliWords(Math.floor(n / 1000)) + ' हजार' + (rest ? ' ' + intToNepaliWords(rest) : '')
  }
  const h = Math.floor(n / 100)
  const r = n % 100
  let out = ''
  if (h > 0) out += NE_ONES[h] + ' सय'
  if (r > 0) out += (out ? ' ' : '') + NE_ONES[r]
  return out
}

/**
 * Number → Nepali words. Whole numbers come back as pure words
 * (25538 → 'पच्चीस हजार पाँच सय अड्तीस'); amounts with paisa get the
 * रूपैयाँ/पैसा suffixes (115538.50 → 'एक लाख पन्ध्र हजार पाँच सय अठ्ठासी
 * रूपैयाँ पचास पैसा'). Zero → 'शून्य'; negatives take an 'ऋणात्मक ' prefix.
 * Values beyond MAX_WORDS fall back to formatted digits.
 */
export function numberToNepaliWords(n: number): string {
  if (!Number.isFinite(n)) return 'शून्य'
  if (n === 0) return 'शून्य'
  let prefix = ''
  if (n < 0) {
    prefix = 'ऋणात्मक '
    n = -n
  }
  if (n > MAX_WORDS) return prefix + formatNepaliAmount(n)
  const whole = Math.floor(n)
  const dec = Math.round((n - whole) * 100)
  const wholeWords = intToNepaliWords(whole)
  if (dec > 0) {
    return prefix + (wholeWords ? wholeWords + ' रूपैयाँ ' : '') + intToNepaliWords(dec) + ' पैसा'
  }
  return prefix + wholeWords
}

/**
 * Amount → Indian-style grouping (last 3 digits, then 2-2: 11,55,538) with
 * Nepali digits. 1155538.5 → '११,५५,५३८.५०'. Negative amounts keep a
 * leading minus sign.
 */
export function formatNepaliAmount(n: number): string {
  if (!Number.isFinite(n)) return 'शून्य'
  const neg = n < 0
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.')
  let grouped = intPart
  if (intPart.length > 3) {
    const head = intPart.slice(0, -3)
    const tail = intPart.slice(-3)
    grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail
  }
  return (neg ? '-' : '') + toNepaliDigits(grouped + '.' + decPart)
}
