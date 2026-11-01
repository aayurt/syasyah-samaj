/** Numeric id for a relationship value that may be a populated object. */
export function accId(v: unknown): number {
  if (v && typeof v === 'object') return Number((v as { id: unknown }).id)
  return Number(v)
}
