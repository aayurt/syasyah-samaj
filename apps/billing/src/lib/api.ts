import { API_BASE } from './base'
import { getEngine, useSyncState } from './offline'
import { isNetworkError, parsePath } from './offline/syncEngine'

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
  }
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const res = await fetch(url, init)
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

/**
 * Cache-first API client for plain collection reads: serve the local copy
 * instantly (no skeleton on warm caches), then refresh the cache in the
 * background so the view updates with fresh data. Writes are network-first
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

  // Cache-first: a warm collection list renders immediately; the background
  // refresh updates the cache (and subscribed views) when fresh data lands.
  if (plainList) {
    const cached = await engine.readCollection(slug)
    if (cached) {
      void engine.refresh(slug)
      return {
        ...cached,
        docs: sortCached(cached.docs, options.query?.sort),
        totalPages: 1,
        page: 1,
      } as unknown as T
    }
  }

  try {
    const res = await doFetch<T>(path, options)
    engine.setOnline(true)
    // A successful write changes the collection — drop the cached copy so
    // the next read (e.g. the page's post-save reload) fetches fresh data
    // instead of serving the stale list from cache.
    if (method !== 'GET' && slug && segments.length <= 2) {
      try {
        await engine.invalidate(slug)
      } catch {
        // best-effort
      }
    }
    // Warm the read cache only for plain collection lists — never for
    // computed endpoints (trial-balance, daybook…) whose `docs` array has a
    // different shape than the collection's documents.
    if (plainList && Array.isArray((res as { docs?: unknown }).docs)) {
      try {
        await engine.warmCache(slug, (res as { docs: Record<string, unknown>[] }).docs)
      } catch {
        // cache writes are best-effort
      }
    }
    return res
  } catch (err) {
    if (isNetworkError(err)) {
      engine.setOnline(false)
      // fall through to offline handling
    } else {
      throw err
    }
  }

  // --- offline path ---
  if (method === 'GET') {
    if (plainDoc) {
      const doc = await engine.readDoc(slug, id)
      if (doc) return doc as unknown as T
    } else if (plainList) {
      const cached = await engine.readCollection(slug)
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
