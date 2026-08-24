import { API_BASE } from './base'
import { getEngine, useSyncState } from './offline'
import {
  isNetworkError,
  isReportPath,
  parsePath,
  reportCacheKey,
} from './offline/syncEngine'
import { pushToast } from './toast'

/** Human noun per collection, used in CRUD toasts. */
const NOUNS: Record<string, string> = {
  documents: 'voucher',
  'gl-accounts': 'account',
  'account-groups': 'account group',
  'journal-entries': 'journal entry',
  parties: 'party',
  items: 'item',
  'stock-movements': 'stock movement',
  users: 'user',
  tenants: 'tenant',
  settings: 'setting',
  globals: 'settings',
}

function crudToast(method: string, path: string, error?: string): void {
  const { slug } = parsePath(path)
  const noun = NOUNS[slug] ?? slug.replace(/-/g, ' ')
  // Globals (Settings) use POST to update an existing singleton — "Saved",
  // not "Created".
  const action = path === '/globals/billing-settings'
    ? 'Saved'
    : path.endsWith('/post')
      ? 'Posted'
      : path.endsWith('/void')
        ? 'Voided'
        : method === 'POST'
          ? 'Created'
          : method === 'PATCH'
            ? 'Updated'
            : method === 'DELETE'
              ? 'Deleted'
              : 'Saved'
  const nounCap = noun.charAt(0).toUpperCase() + noun.slice(1)
  if (error) {
    pushToast('error', `${action} ${noun} failed`, error)
  } else {
    pushToast('success', `${nounCap} ${action.toLowerCase()}`)
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | undefined>
  body?: unknown
}

async function doFetch<T>(path: string, options: ApiOptions): Promise<T> {
  const { query, body, headers, ...rest } = options
  const url = new URL(`${API_BASE}/api${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
    // A bare `tenant` param filters custom report endpoints, but Payload's
    // standard list endpoints only filter through `where[tenant][equals]`.
    // Emit both so selecting an illaka filters plain collection lists too.
    const t = query.tenant
    if (t !== undefined && t !== '') {
      url.searchParams.set('where[tenant][equals]', String(t))
    }
  }
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }    // A hang (half-open connection, captive portal, killed server mid-
    // handshake) never rejects with a clean TypeError — without a timeout the
    // offline path never engages and the user sees a raw error. Time out and
    // throw a TypeError so the caller queues the write instead.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 15_000)
  try {
    const res = await fetch(url, { ...init, signal: timeout.signal })
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`
      try {
        const b = await res.json()
        msg = b?.errors?.[0]?.message || b?.message || b?.error || msg
      } catch {
        // non-JSON error body
      }
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  } catch (err) {
    // AbortError is a DOMException, not a TypeError — normalize it so
    // isNetworkError() (instanceof TypeError) treats it as offline.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TypeError('network timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** True for plain collection reads: `GET /slug` (list) or `GET /slug/:id`. */
function pathSegments(path: string): string[] {
  return path
    .split('?')[0]
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
}

/** Client-side sort matching Payload's `sort=-field` convention. */
function sortCached(
  docs: Record<string, unknown>[],
  sort?: string | number,
): Record<string, unknown>[] {
  if (!sort || docs.length < 2) return docs
  const raw = String(sort)
  const desc = raw.startsWith('-')
  const field = desc ? raw.slice(1) : raw
  const get = (d: Record<string, unknown>) => d?.[field]
  const sorted = [...docs].sort((a, b) => {
    const av = get(a)
    const bv = get(b)
    if (av === bv) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv))
  })
  return desc ? sorted.reverse() : sorted
}

/* ── Global settings localStorage cache ─────────────────────────────── */
const GS_KEY = 'billing.settingsCache'
const GS_TTL = 5 * 60 * 1000 // 5 minutes

function readGlobalsCache(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(GS_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    return Date.now() - ts < GS_TTL ? data : null
  } catch { return null }
}

function writeGlobalsCache(data: unknown): void {
  try {
    localStorage.setItem(GS_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Cache-first API client for plain collection reads: serve the local copy
 * instantly (no skeleton on warm caches). Fresh data is pulled only when the
 * user hits the resync button (or after a write invalidates the cache, which
 * makes the next read fall through to the network). Writes are network-first
 * and queue to the outbox when offline; computed endpoints stay
 * network-first. See lib/offline.
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const engine = getEngine()
  const method = (options.method || 'GET').toUpperCase()
  const { slug, id } = parsePath(path)
  const segments = pathSegments(path)
  const plainList = method === 'GET' && segments.length === 1 && !!slug
  const plainDoc = method === 'GET' && segments.length === 2 && !!id
  // Only known computed endpoints (trial-balance, ledger, daybook, aging)
  // are reports — NOT every /slug/:action (e.g. /documents/number/next).
  const report = method === 'GET' && isReportPath(path)
  const reportKey = report ? reportCacheKey(path, options.query) : null

  const isGlobals = method === 'GET' && path === '/globals/billing-settings'

  // Extract tenant for scope-partitioned cache keys.
  const tenant = options.query?.tenant ? String(options.query.tenant) : undefined

  // Cache-first for globals — calendar settings must be instant on page load.
  if (isGlobals) {
    const cached = readGlobalsCache()
    if (cached) {
      // Serve from cache, but refresh in background
      doFetch<T>(path, options).then((fresh) => {
        writeGlobalsCache(fresh)
      }).catch(() => { /* stale cache is fine */ })
      return cached as unknown as T
    }
  }

  // Cache-first: a warm collection list renders immediately. Fresh data is
  // pulled on demand via the resync button — reads never trigger a network
  // fetch on their own.
  if (plainList) {
    const cached = await engine.readCollection(slug, tenant)
    if (cached) {
      return {
        ...cached,
        docs: sortCached(cached.docs, options.query?.sort),
        totalPages: 1,
        page: 1,
      } as unknown as T
    }
  }

  // ── Standard CRUD writes: queue to outbox, batch via POST /api/sync ──
  // Custom endpoints (/:id/post, /:id/void, /:id/reopen, etc.) still go
  // through individual fetch because they have server-side business logic.
  const lastSeg = segments[segments.length - 1]
  const isCustomEndpoint = (
    // Custom action endpoints (/:id/action)
    (segments.length >= 2 && (
      lastSeg === 'post' ||
      lastSeg === 'void' ||
      lastSeg === 'reopen' ||
      lastSeg === 'partial-void' ||
      lastSeg === 'confirm' ||
      lastSeg === 'pay-fee' ||
      lastSeg === 'stock-levels' ||
      lastSeg === 'number'
    )) ||
    // Singleton globals — not standard CRUD
    path.startsWith('/globals/')
  )
  const isStandardWrite = method !== 'GET' && !isCustomEndpoint && slug && segments.length <= 2

  if (isStandardWrite && options.body) {
    // Queue the write to the outbox for batch sync
    try {
      const result = await engine.offlineRequest(method, path, options.body)
      engine.setOnline(true)
      crudToast(method, path)
      return result as T
    } catch {
      // Queue failed — fall through to direct fetch
    }
  }

  try {
    const res = await doFetch<T>(path, options)
    engine.setOnline(true)
    // Cache globals on successful read
    if (isGlobals) writeGlobalsCache(res)
    // A successful write changes the collection — optimistically update the
    // cache so the list re-renders immediately (no skeleton / stale data).
    if (method !== 'GET' && slug && segments.length <= 2) {
      try {
        const resData = res as Record<string, unknown>
        const doc = resData?.doc as Record<string, unknown> | undefined
        if (method === 'POST' && doc?.id) {
          // New document — upsert into collection cache
          await engine.warmCache(slug, [doc], tenant)
        } else if (method === 'PATCH' && id && doc) {
          // Updated document — upsert into collection cache
          await engine.warmCache(slug, [doc], tenant)
        } else {
          // Fallback: invalidate so next read is fresh
          await engine.invalidate(slug, tenant)
        }
      } catch {
        // best-effort
      }
    }
    if (method !== 'GET') {
      crudToast(method, path)
      // Update globals cache with fresh data (don't invalidate)
      if (path === '/globals/billing-settings') {
        try { writeGlobalsCache(res) } catch { /* ignore */ }
      }
    }
    // Warm the read cache only for plain collection lists — never for
    // computed endpoints (trial-balance, daybook…) whose `docs` array has a
    // different shape than the collection's documents.
    if (plainList && Array.isArray((res as { docs?: unknown }).docs)) {
      try {
        await engine.warmCache(slug, (res as { docs: Record<string, unknown>[] }).docs, tenant)
      } catch {
        // cache writes are best-effort
      }
    }
    // Reports stay network-first for freshness, but snapshot the payload
    // for offline use and record when it was last truly synced.
    if (report && reportKey) {
      try {
        await engine.writeReport(reportKey, res)
        engine.markReportsSynced()
      } catch {
        // cache writes are best-effort
      }
    }
    return res
  } catch (err) {
    if (isNetworkError(err)) {
      // Don't set offline here — the heartbeat determines connectivity.
      // Fall through to the offline path (cache / outbox) instead.
    } else {
      if (method !== 'GET') {
        crudToast(
          method,
          path,
          err instanceof Error ? err.message : String(err),
        )
      }
      throw err
    }
  }

  // --- offline path ---
  if (method === 'GET') {
    if (isGlobals) {
      const cached = readGlobalsCache()
      if (cached) return cached as unknown as T
      throw new Error('Offline — billing settings have not been synced yet.')
    }
    if (report && reportKey) {
      const hit = await engine.readReport(reportKey)
      if (hit) {
        engine.markReportsStale()
        return hit.payload as T
      }
      throw new Error('Offline — this report has not been synced yet.')
    }
    if (plainDoc) {
      const doc = await engine.readDoc(slug, id)
      if (doc) return doc as unknown as T
    } else if (plainList) {
      const cached = await engine.readCollection(slug, tenant)
      if (cached) {
        return {
          ...cached,
          docs: sortCached(cached.docs, options.query?.sort),
          totalPages: 1,
          page: 1,
        } as unknown as T
      }
    }
    throw new Error('Offline — this view is not in the local cache yet.')
  }

  // Writes queue to the outbox and resolve immediately.
  return (await engine.offlineRequest(method, path, options.body)) as T
}

export interface ListResponse<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
}

export const list = <T>(
  slug: string,
  query?: Record<string, string | number | undefined>,
) =>
  api<ListResponse<T>>(`/${slug}`, {
    query: { limit: 1000, depth: 1, ...query },
  })

export const fmt = (n: number | undefined | null): string =>
  (n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export { getEngine, useSyncState }
