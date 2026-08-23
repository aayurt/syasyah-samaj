/**
 * Evaluate simple arithmetic expressions in amount fields.
 * Supports: +, -, *, /, parentheses, decimals.
 * Returns the original string if it's not a valid expression.
 *
 * Examples:
 *   "1000+500"       → "1500"
 *   "1000-200*0.13"  → "974"
 *   "(5000+1000)/6"  → "1000"
 *   "1234"           → "1234" (plain number, no change)
 *   "abc"            → "abc" (invalid, no change)
 */
export function calcEval(input: string): string {
  if (!input || typeof input !== 'string') return input
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  // Only evaluate if it contains operators (not a plain number)
  if (!/[+\-*/()]/.test(trimmed)) return trimmed

  // Allow only digits, dots, operators, parentheses, and spaces
  if (/[^0-9+\-*/().\s]/.test(trimmed)) return trimmed

  try {
    // Use Function constructor for safe math evaluation
    // Only allows numbers and math operators — no variable access
    const result = new Function(`"use strict"; return (${trimmed})`)()
    if (typeof result === 'number' && isFinite(result)) {
      // Round to 2 decimal places to avoid floating point weirdness
      return String(Math.round(result * 100) / 100)
    }
    return trimmed
  } catch {
    return trimmed
  }
}

/**
 * onBlur handler factory for number inputs.
 * Evaluates expressions like "1000+500" → "1500".
 */
export function calcOnBlur(
  e: React.FocusEvent<HTMLInputElement>,
  setValue: (v: string) => void,
) {
  const result = calcEval(e.target.value)
  if (result !== e.target.value) {
    setValue(result)
  }
}
