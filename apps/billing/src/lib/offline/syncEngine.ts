/* Shared sync helpers used by api.ts.
 *
 * The legacy SyncEngine class that used to live here was removed — it was
 * fully superseded by lib/sync/SyncEngine.ts (wrapped by the
 * CompatibilityEngine in offline/index.ts). */

/** Collections the background sync loop refreshes after a flush. */
export const SYNC_COLLECTIONS = [
  'gl-accounts',
  'account-groups',
  'journal-entries',
  'documents',
  'parties',
  'items',
  'tax-types',
]

export const LOCAL_PREFIX = 'local-'

export function isLocalId(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(LOCAL_PREFIX)
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Parses an API path into its collection slug and (when present) document id.
 * Report endpoints like `/journal-entries/trial-balance` have no id segment.
 */
export function parsePath(path: string): { slug: string; id: string | null } {
  const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '')
  const parts = clean.split('/')
  const slug = parts[0] || ''
  const maybe = parts[1] || ''
  const id =
    maybe && (isLocalId(maybe) || /^\d+$/.test(maybe)) ? maybe : null
  return { slug, id }
}

/** The report endpoints the app warms ahead of time (network-first, then
 * cached). Party-scoped reports like /ledger are cached on read instead. */
export const CORE_REPORTS = [
  'trial-balance',
  'profit-loss',
  'balance-sheet',
  'daybook',
]

export const REPORT_SLUG = 'journal-entries'

/** kv key holding the last time a report was fetched from the server, so
 * the staleness marker survives page reloads (the in-memory state resets). */
export const LAST_REPORT_SYNC_KEY = 'report:lastSyncedAt'

/**
 * The actual computed report endpoints (path without query). Only these are
 * treated as cacheable reports — anything else at /slug/:action (e.g.
 * /documents/number/next) is a plain API call, so it must not be routed
 * through the report cache or mislabeled as a report when offline.
 */
export const REPORT_PATHS = new Set([
  `/${REPORT_SLUG}/trial-balance`,
  `/${REPORT_SLUG}/ledger`,
  `/${REPORT_SLUG}/profit-loss`,
  `/${REPORT_SLUG}/balance-sheet`,
  `/${REPORT_SLUG}/daybook`,
  '/documents/aging',
])

export function isReportPath(path: string): boolean {
  return REPORT_PATHS.has(path.split('?')[0].replace(/\/+$/, ''))
}

/**
 * Deterministic cache key for a report payload: path + normalized query.
 * The same key is derived by api.ts (on read) and warmReports (on write),
 * so they always agree regardless of key order in the query object.
 */
export function reportCacheKey(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const entries = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const q = JSON.stringify(entries)
  let h = 5381
  const s = `${path.split('?')[0]}\u0000${q}`
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return `report:${h.toString(36)}`
}

/* The legacy SyncEngine class that used to live below this line was removed:
 * it was fully superseded by lib/sync/SyncEngine.ts (wrapped by the
 * CompatibilityEngine in offline/index.ts). Only these shared helpers,
 * still imported by api.ts, remain. */
