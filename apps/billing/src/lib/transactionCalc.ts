/* ================================================================
 * Transaction-line calculation engine.
 *
 * Handles per-line amount/tax/total plus document-level totals.
 * Supports both tax-inclusive and tax-exclusive line amounts.
 * Pure functions — easy to test, no React dependency.
 * ================================================================ */

export type TaxNature = 'additive' | 'inclusive' | 'withholding'

export interface LineInput {
  key?: string
  item?: string | number | null
  description?: string
  unit?: string
  subAccount?: string | number | null
  account?: string | number | null
  qty?: string | number | null
  rate?: string | number | null
  amount?: string | number | null        // pre-calculated amount (qty*rate or manual)
  discountPct?: string | number | null   // percent of amount
  discountAmt?: string | number | null   // flat amount off
  taxType?: string | number | null       // tax type id
  taxRate?: string | number | null       // explicit rate override
  taxNature?: TaxNature                  // additive | inclusive | withholding
}

export interface LineResult {
  qty: number
  rate: number
  gross: number             // qty * rate
  discountPct: number
  discountAmt: number
  discountTotal: number
  subtotal: number          // gross - discounts
  taxRate: number
  taxAmt: number            // tax on subtotal (additive) or embedded (inclusive)
  taxBase: number           // amount tax applies to
  total: number             // line total to post
  lineTax: number           // tax portion exposed for tax-line aggregation
}

export interface DocResult {
  lines: LineResult[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
}

const n = (v: string | number | null | undefined, def = 0): number => {
  if (v === null || v === undefined || v === '') return def
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}

/** Round to 2 dp (currency). */
const r2 = (x: number): number => Math.round(x * 100) / 100

/** Parse a line input into a LineResult. */
export function calcLine(input: LineInput): LineResult {
  const qty = Math.max(0, n(input.qty, 1))
  const rate = Math.max(0, n(input.rate, 0))
  const gross = r2(qty * rate)

  // Amount takes precedence if explicitly provided (manual override).
  const amountOverride = n(input.amount, NaN)
  let lineGross = gross
  if (Number.isFinite(amountOverride)) lineGross = r2(amountOverride)

  const discountPct = Math.max(0, Math.min(100, n(input.discountPct, 0)))
  const discountAmt = Math.max(0, n(input.discountAmt, 0))
  const discountTotal = r2(lineGross * (discountPct / 100)) + discountAmt

  const subtotal = r2(Math.max(0, lineGross - discountTotal))

  const taxNature: TaxNature = input.taxNature || 'additive'
  const taxRate = Math.max(0, n(input.taxRate, 0))

  let taxAmt = 0
  let taxBase = subtotal
  let lineTax = 0

  if (taxNature === 'additive') {
    taxAmt = r2(subtotal * (taxRate / 100))
    lineTax = taxAmt
  } else if (taxNature === 'inclusive') {
    // Tax is embedded in subtotal: tax = subtotal * rate / (100 + rate)
    taxAmt = r2(subtotal * (taxRate / (100 + taxRate)))
    taxBase = r2(subtotal - taxAmt)
    lineTax = taxAmt
  }
  // withholding: tax is deducted from payment, not added to line total
  else {
    taxAmt = r2(subtotal * (taxRate / 100))
    lineTax = -taxAmt
  }

  const total = taxNature === 'inclusive' || taxNature === 'withholding' ? subtotal : r2(subtotal + taxAmt)

  return {
    qty,
    rate,
    gross: lineGross,
    discountPct,
    discountAmt,
    discountTotal,
    subtotal,
    taxRate,
    taxAmt,
    taxBase,
    total,
    lineTax,
  }
}

/** Aggregate line results into document totals. */
export function calcDoc(lines: LineInput[]): DocResult {
  const results = lines.map((l) => calcLine(l))
  const subtotal = r2(results.reduce((s, l) => s + l.subtotal, 0))
  const discountTotal = r2(results.reduce((s, l) => s + l.discountTotal, 0))
  const taxTotal = r2(results.reduce((s, l) => s + l.lineTax, 0))
  const grandTotal = r2(results.reduce((s, l) => s + l.total, 0))
  return { lines: results, subtotal, discountTotal, taxTotal, grandTotal }
}

/** Self-check (run once on import in tests). */
export function __selfCheck(): void {
  const additive = calcLine({ qty: 2, rate: 100, taxRate: 10, taxNature: 'additive' })
  if (additive.subtotal !== 200 || additive.taxAmt !== 20 || additive.total !== 220) {
    throw new Error(`additive calc failed: ${JSON.stringify(additive)}`)
  }
  const inclusive = calcLine({ qty: 1, rate: 110, taxRate: 10, taxNature: 'inclusive' })
  if (inclusive.taxAmt !== 10 || inclusive.taxBase !== 100 || inclusive.total !== 110) {
    throw new Error(`inclusive calc failed: ${JSON.stringify(inclusive)}`)
  }
  const withDisc = calcLine({ qty: 1, rate: 100, discountPct: 10, taxRate: 10, taxNature: 'additive' })
  if (withDisc.subtotal !== 90 || withDisc.total !== 99) {
    throw new Error(`discount calc failed: ${JSON.stringify(withDisc)}`)
  }
  const doc = calcDoc([
    { qty: 2, rate: 100, taxRate: 10, taxNature: 'additive' },
    { qty: 1, rate: 50, taxRate: 0, taxNature: 'additive' },
  ])
  if (doc.subtotal !== 250 || doc.taxTotal !== 20 || doc.grandTotal !== 270) {
    throw new Error(`doc calc failed: ${JSON.stringify(doc)}`)
  }
}

if (process.env.NODE_ENV === 'test') __selfCheck()
