/** Parse displayed money back to a number. Handles "25,538.00", "Rs. 1,560",
 * "−4,000", "(4,000)" negative parens, and trailing minus. The decimal
 * point is kept (list cells render 2-dp like "500,000.00"). */
export function money(text: string | null | undefined): number {
  if (!text) return 0
  let s = String(text).trim()
  const neg = s.startsWith('(') || s.startsWith('-') || /−/.test(s) || /minus/i.test(s)
  // strip currency glyphs, thousand separators, whitespace and signs — but
  // NOT the '.' decimal point
  s = s.replace(/[()₹Rs,\s−-]/g, '')
  const n = parseFloat(s)
  if (Number.isNaN(n)) return 0
  return neg ? -Math.abs(n) : Math.abs(n)
}

/** Assert two money values agree within rounding (0.01). */
export function expectMoney(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.011
}
