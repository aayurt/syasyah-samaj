/**
 * Pagination parsing for report endpoints.
 *
 * Report endpoints aggregate full data sets before presenting (running
 * balances, aging buckets, etc.), so pagination is applied to the *results*
 * array, not the DB query. `limit` and `offset` come from query params:
 *
 *   ?limit=50&offset=100
 *
 * Returns a page (slice) plus the total count so the client can render
 * pager controls. Defaults: no limit (all rows).
 */
export function parsePagination(
  params: URLSearchParams,
): { limit: number; offset: number } {
  const rawLimit = params.get('limit')
  const rawOffset = params.get('offset')
  const limit = rawLimit ? Math.max(1, parseInt(rawLimit, 10) || 1) : Infinity
  const offset = rawOffset ? Math.max(0, parseInt(rawOffset, 10) || 0) : 0
  return { limit, offset }
}

export function paginate<T>(
  rows: T[],
  pagination: { limit: number; offset: number },
): { docs: T[]; total: number; hasMore: boolean } {
  const { limit, offset } = pagination
  const total = rows.length
  const page = Number.isFinite(limit) ? rows.slice(offset, offset + limit) : rows
  return { docs: page, total, hasMore: Number.isFinite(limit) && offset + limit < total }
}