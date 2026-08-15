import { API_BASE } from '../base'
import type { OfflineDb, OutboxEntry, SyncState } from './types'

export const LOCAL_PREFIX = 'local-'

export function isLocalId(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(LOCAL_PREFIX)
}

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
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

export class SyncEngine {
  private online = true
  private banners: SyncState['banners'] = []
  private lastSyncAt: string | null = null
  private pendingHint = 0
  private cacheVersion = 0
  /** Per-collection timestamp of the last background refresh (throttle). */
  private lastRefresh: Record<string, number> = {}
  private listeners = new Set<(s: SyncState) => void>()
  private reportsStale = false
  private lastReportSyncAt: number | null = null
  private lastReportWarm = 0

  constructor(private db: OfflineDb) {}

  getState(): SyncState {
    return {
      online: this.online,
      pending: this.pendingHint,
      lastSyncAt: this.lastSyncAt,
      banners: [...this.banners],
      cacheVersion: this.cacheVersion,
      reportsStale: this.reportsStale,
      lastReportSyncAt: this.lastReportSyncAt,
    }
  }

  /** Dismisses a conflict banner by index. */
  dismissBanner(index: number) {
    this.banners.splice(index, 1)
    this.emit()
  }

  subscribe(fn: (s: SyncState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    const state = this.getState()
    for (const fn of this.listeners) fn(state)
  }

  private async refreshPending(): Promise<number> {
    return this.db.pendingCount()
  }

  setOnline(online: boolean) {
    if (this.online === online) return
    this.online = online
    this.emit()
  }

  async pendingCount(): Promise<number> {
    return this.db.pendingCount()
  }

  // --- kv passthroughs (used for cached session + cursors) --------------

  async getKey(key: string): Promise<string | null> {
    return this.db.getKey(key)
  }

  async setKey(key: string, value: string): Promise<void> {
    await this.db.setKey(key, value)
  }

  async deleteKey(key: string): Promise<void> {
    await this.db.deleteKey(key)
  }

  private addBanner(message: string) {
    this.banners.push({ message, at: new Date().toISOString() })
    if (this.banners.length > 5) this.banners.shift()
  }

  private bumpPending(delta: number) {
    this.pendingHint = Math.max(0, this.pendingHint + delta)
  }

  // --- queuing -------------------------------------------------------------

  newLocalId(): string {
    const rnd =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10)
    return `${LOCAL_PREFIX}${rnd}`
  }

  /**
   * Handles a write while offline: queue it. Creates return a local id so the
   * UI can keep referencing the resource; the id is mapped to the server id
   * when the queue flushes.
   */
  async offlineRequest(
    method: string,
    path: string,
    body: unknown,
  ): Promise<unknown> {
    const { id } = parsePath(path)
    const queuedAt = new Date().toISOString()
    if (method === 'POST' && !id) {
      const localId = this.newLocalId()
      await this.db.enqueue({
        method,
        path,
        body,
        queuedAt,
        localId,
      })
      this.bumpPending(1)
      this.emit()
      return { doc: { id: localId }, queued: true }
    }
    await this.db.enqueue({ method, path, body, queuedAt })
    this.bumpPending(1)
    this.emit()
    return { queued: true }
  }

  // --- sync ----------------------------------------------------------------

  private async loadIdMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const raw = await this.db.getKey('idmap')
    if (raw) {
      for (const [k, v] of Object.entries(JSON.parse(raw))) {
        map.set(k, String(v))
      }
    }
    return map
  }

  private async saveIdMap(map: Map<string, string>) {
    await this.db.setKey('idmap', JSON.stringify(Object.fromEntries(map)))
  }

  private rewrite(value: string, map: Map<string, string>): string {
    let out = value
    for (const [local, server] of map) {
      out = out.split(local).join(server)
    }
    return out
  }

  private async fetchServerDoc(
    slug: string,
    id: string,
  ): Promise<{ updatedAt?: string } | null> {
    const res = await fetch(`${API_BASE}/api/${slug}/${id}?depth=0`, {
      credentials: 'include',
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // Payload returns the document directly (not wrapped in `doc`) for GET /:id.
    return data?.doc ?? data ?? null
  }

  /** Applies one queued entry. Returns 'pushed' or 'conflict'. */
  private async apply(
    entry: OutboxEntry,
    idMap: Map<string, string>,
    freshIds: Set<string>,
  ): Promise<'pushed' | 'conflict'> {
    const { slug, id } = parsePath(entry.path)
    const path = this.rewrite(entry.path, idMap)
    const body = this.rewriteBody(entry.body, idMap)
    const targetId = id ? this.rewrite(id, idMap) : null

    // Conflict check for updates/actions against an existing server document.
    if (targetId && !freshIds.has(targetId)) {
      const server = await this.fetchServerDoc(slug, targetId)
      if (server === null) {
        if (entry.method !== 'DELETE') {
          this.addBanner(
            `Dropped queued change — the document no longer exists on the server.`,
          )
          return 'conflict'
        }
        return 'pushed'
      }
      if (
        server.updatedAt &&
        new Date(server.updatedAt).getTime() >
          new Date(entry.queuedAt).getTime()
      ) {
        this.addBanner(
          `Conflict: the server copy of ${slug} ${targetId} is newer — kept the server version and dropped the queued change.`,
        )
        return 'conflict'
      }
    }

    const res = await fetch(`${API_BASE}/api${path}`, {
      method: entry.method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
    })
    if (!res.ok) {
      if (res.status === 409) {
        this.addBanner(
          `Conflict while syncing ${entry.method} ${path} — skipped (server rejected it).`,
        )
        return 'conflict'
      }
      if (res.status === 401 || res.status === 403) {
        this.addBanner(
          `Could not sync — you are not authenticated. Sign in again and retry.`,
        )
        return 'conflict'
      }
      const data = await res.json().catch(() => ({}))
      throw new Error(
        data?.message || data?.error || `HTTP ${res.status} syncing ${path}`,
      )
    }

    // Capture local → server id mapping for queued creates.
    if (entry.method === 'POST' && !targetId && entry.localId) {
      const data = await res.json().catch(() => null)
      const serverId = data?.doc?.id ?? data?.id
      if (serverId !== undefined && serverId !== null) {
        const sid = String(serverId)
        idMap.set(entry.localId, sid)
        freshIds.add(sid)
        await this.saveIdMap(idMap)
      }
    }
    return 'pushed'
  }

  private rewriteBody(body: unknown, map: Map<string, string>): unknown {
    if (map.size === 0) return body
    const fix = (v: unknown): unknown => {
      if (typeof v === 'string' && map.has(v)) {
        // Relationship ids in this API are numeric — convert so Payload accepts them.
        const server = map.get(v)!
        return /^\d+$/.test(server) ? Number(server) : server
      }
      if (Array.isArray(v)) return v.map(fix)
      if (v && typeof v === 'object') {
        return Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, x]) => [
            k,
            fix(x),
          ]),
        )
      }
      return v
    }
    return fix(JSON.parse(JSON.stringify(body ?? {})))
  }

  /**
   * Flushes the outbox in order. Stops on network failure (still offline) and
   * keeps the remaining queue. Conflicts drop the losing change with a banner.
   */
  async flush(): Promise<{ pushed: number; conflicts: number }> {
    const pending = await this.db.pending()
    if (pending.length === 0) {
      this.lastSyncAt = new Date().toISOString()
      this.emit()
      return { pushed: 0, conflicts: 0 }
    }
    const idMap = await this.loadIdMap()
    const freshIds = new Set<string>()
    let pushed = 0
    let conflicts = 0
    let processed = 0
    for (const entry of pending) {
      try {
        const outcome = await this.apply(entry, idMap, freshIds)
        if (outcome === 'pushed') pushed++
        else conflicts++
        processed++
        await this.db.remove(entry.seq)
      } catch (err) {
        if (isNetworkError(err)) break // still offline — retry later
        processed++
        conflicts++
        this.addBanner(`Could not sync "${entry.method} ${entry.path}": ${msg(err)}`)
        await this.db.remove(entry.seq)
      }
    }
    this.bumpPending(-processed)
    this.lastSyncAt = new Date().toISOString()
    this.emit()
    return { pushed, conflicts }
  }

  /**
   * Background refresh of one collection: incremental cursor pull that
   * upserts changed documents into the read cache. Throttled so the many
   * cache-first reads on a page don't each trigger a network fetch, and
   * silent on failure (offline) — the cached copy stays authoritative.
   */
  async refresh(collection: string): Promise<void> {
    const now = Date.now()
    if (now - (this.lastRefresh[collection] ?? 0) < 10_000) return
    this.lastRefresh[collection] = now
    try {
      await this.pull(collection)
    } catch (err) {
      // Offline or collection missing — the cached copy remains valid. Flag
      // a network failure so the sync pill shows the real connection state.
      if (isNetworkError(err)) this.setOnline(false)
    }
  }

  /**
   * Incremental pull for one collection using an updatedAt cursor, upserting
   * each changed document into the local cache. Uses the bracket where form
   * (this Payload build silently ignores the JSON form) and depth 1 so cached
   * documents carry the populated relations the UI renders.
   */
  async pull(collection: string): Promise<number> {
    const cursor = await this.db.getKey(`cursor:${collection}`)
    const params = new URLSearchParams({
      limit: '1000',
      depth: '1',
      sort: 'updatedAt',
    })
    if (cursor) params.append('where[updatedAt][greater_than]', cursor)
    const res = await fetch(`${API_BASE}/api/${collection}?${params}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      throw new Error(`Pull failed for ${collection}: HTTP ${res.status}`)
    }
    const data = await res.json()
    const docs = (data.docs as Record<string, unknown>[]) || []
    let latest = cursor
    for (const doc of docs) {
      const up = doc.updatedAt as string | undefined
      if (up && (!latest || up > latest)) latest = up
    }
    const changed = await this.writeChanged(collection, docs)
    if (latest) await this.db.setKey(`cursor:${collection}`, latest)
    // Marks the collection as pulled so even an empty one serves from cache
    // instead of re-hitting the network on every view.
    await this.db.setKey(`pulled:${collection}`, '1')
    this.setOnline(true)
    if (changed > 0) this.bumpCache()
    return docs.length
  }

  /** Upserts only documents that are new or whose updatedAt changed. */
  private async writeChanged(
    collection: string,
    docs: Record<string, unknown>[],
  ): Promise<number> {
    let changed = 0
    for (const doc of docs) {
      const id = doc?.id
      if (id == null) continue
      const existing = await this.db.cacheGet(collection, String(id))
      if (!existing || existing.updatedAt !== doc.updatedAt) {
        await this.db.cacheUpsert(collection, doc)
        changed++
      }
    }
    return changed
  }

  private bumpCache() {
    this.cacheVersion++
    this.emit()
  }

  /** Writes a freshly-fetched list into the read cache (marks it pulled). */
  async warmCache(
    collection: string,
    docs: Record<string, unknown>[],
  ): Promise<void> {
    await this.db.setKey(`pulled:${collection}`, '1')
    const changed = await this.writeChanged(collection, docs)
    if (changed > 0) this.bumpCache()
  }

  /**
   * Drops the cached copy of a collection (and its pull cursor) so the next
   * read hits the server. Called after successful writes so the UI never
   * serves a stale list right after the user saved something.
   */
  async invalidate(collection: string): Promise<void> {
    await this.db.clearCache(collection)
    await this.db.deleteKey(`cursor:${collection}`)
    await this.db.deleteKey(`pulled:${collection}`)
  }

  // --- report cache --------------------------------------------------------

  /** Returns the cached report payload and when it was fetched, or null. */
  async readReport(
    key: string,
  ): Promise<{ payload: unknown; syncedAt: number } | null> {
    const raw = await this.db.getKey(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async writeReport(key: string, payload: unknown): Promise<void> {
    await this.db.setKey(
      key,
      JSON.stringify({ payload, syncedAt: Date.now() }),
    )
  }

  /** A report was fetched fresh from the server — staleness clears. */
  markReportsSynced() {
    this.lastReportSyncAt = Date.now()
    void this.db
      .setKey(LAST_REPORT_SYNC_KEY, String(this.lastReportSyncAt))
      .catch(() => {})
    if (this.reportsStale) {
      this.reportsStale = false
      this.emit()
    }
  }

  /** A report was served from the local cache — flag it in the sync pill. */
  markReportsStale() {
    if (!this.reportsStale) {
      this.reportsStale = true
      this.emit()
    }
    // The in-memory timestamp resets on page load; recover the persisted
    // one so the pill can show how old the statement really is.
    void this.db.getKey(LAST_REPORT_SYNC_KEY).then((raw) => {
      if (raw && !this.lastReportSyncAt) {
        this.lastReportSyncAt = Number(raw)
        this.emit()
      }
    })
  }

  /**
   * Background refresh of the core reports: network-first, best-effort, and
   * silently skipped while offline (the cached statement stays authoritative
   * and the pill shows its age). Throttled — the pull loop calls this every
   * 30s but it only really fetches at most once a minute.
   */
  async warmReports(): Promise<void> {
    const now = Date.now()
    if (now - this.lastReportWarm < 60_000) return
    this.lastReportWarm = now
    for (const name of CORE_REPORTS) {
      const path = `/${REPORT_SLUG}/${name}`
      try {
        const res = await fetch(`${API_BASE}/api${path}`, {
          credentials: 'include',
        })
        if (!res.ok) continue
        const data = await res.json()
        await this.writeReport(reportCacheKey(path), data)
        this.markReportsSynced()
      } catch (err) {
        if (isNetworkError(err)) this.setOnline(false)
      }
    }
    this.emit()
  }

  // --- offline reads -------------------------------------------------------

  async readCollection(
    slug: string,
  ): Promise<{ docs: Record<string, unknown>[]; totalDocs: number } | null> {
    const docs = await this.db.cacheList(slug)
    const pulled = await this.db.getKey(`pulled:${slug}`)
    if (docs.length === 0 && !pulled) {
      return null
    }
    return { docs, totalDocs: docs.length }
  }

  /** Returns the cached document directly (Payload's GET /:id shape). */
  async readDoc(
    slug: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return this.db.cacheGet(slug, id)
  }
}
