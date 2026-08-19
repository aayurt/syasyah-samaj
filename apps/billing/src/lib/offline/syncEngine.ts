import { API_BASE } from '../base'
import { pushToast } from '../toast'
import type { OfflineDb, OutboxEntry, SyncState } from './types'

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

export class SyncEngine {
  private online = true
  private banners: SyncState['banners'] = []
  private lastSyncAt: string | null = null
  private pendingHint = 0
  private conflictsHint = 0
  private cacheVersion = 0
  /** Per-collection timestamp of the last background refresh (throttle). */
  private lastRefresh: Record<string, number> = {}
  private listeners = new Set<(s: SyncState) => void>()
  private reportsStale = false
  private lastReportSyncAt: number | null = null
  private lastReportWarm = 0
  /** Network requests (pull/sync) currently in flight. */
  private syncingCount = 0
  /** True while syncAll is running — skips re-entrant background runs. */
  private syncingAll = false

  constructor(private db: OfflineDb) {}

  getState(): SyncState {
    return {
      online: this.online,
      pending: this.pendingHint,
      conflicts: this.conflictsHint,
      lastSyncAt: this.lastSyncAt,
      banners: [...this.banners],
      cacheVersion: this.cacheVersion,
      reportsStale: this.reportsStale,
      lastReportSyncAt: this.lastReportSyncAt,
      syncingCount: this.syncingCount,
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
    for (const fn of this.listeners) {
      try {
        fn(state)
      } catch {
        // A throwing listener must not corrupt engine state or break other
        // listeners — in particular it must never leave syncingCount stuck.
      }
    }
  }

  /** Recomputes the pending/conflict counts from the outbox (cheap: it's a
   * small local table). Called after any queue mutation so the pill stays
   * honest even when conflicted entries are kept around. */
  private async refreshCounts(): Promise<void> {
    try {
      const entries = await this.db.pending()
      this.pendingHint = entries.filter((e) => !e.conflict).length
      this.conflictsHint = entries.filter((e) => e.conflict).length
      this.emit()
    } catch {
      // store unavailable — keep previous hints
    }
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

  /** Refreshes counts on mount so the pill shows queued writes from a
   * previous session. */
  async init() {
    await this.refreshCounts()
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
    const queued = method === 'POST' && !id
    if (queued) {
      const localId = this.newLocalId()
      await this.db.enqueue({
        method,
        path,
        body,
        queuedAt,
        localId,
      })
      await this.refreshCounts()
      pushToast(
        'info',
        'Saved offline',
        'Your change is queued locally and will sync automatically when you reconnect.',
      )
      return { doc: { id: localId }, queued: true }
    }
    await this.db.enqueue({ method, path, body, queuedAt })
    await this.refreshCounts()
    pushToast(
      'info',
      'Saved offline',
      'Your change is queued locally and will sync automatically when you reconnect.',
    )
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

  /** Applies one queued entry. Returns 'pushed' or a conflict reason. */
  private async apply(
    entry: OutboxEntry,
    idMap: Map<string, string>,
    freshIds: Set<string>,
  ): Promise<{ status: 'pushed' } | { status: 'conflict'; message: string }> {
    const { slug, id } = parsePath(entry.path)
    const path = this.rewrite(entry.path, idMap)
    const body = this.rewriteBody(entry.body, idMap)
    const targetId = id ? this.rewrite(id, idMap) : null

    // Conflict check for updates/actions against an existing server document.
    if (targetId && !freshIds.has(targetId)) {
      const server = await this.fetchServerDoc(slug, targetId)
      if (server === null) {
        if (entry.method !== 'DELETE') {
          return {
            status: 'conflict',
            message: `The document no longer exists on the server — this queued change can't be applied.`,
          }
        }
        return { status: 'pushed' }
      }
      if (
        server.updatedAt &&
        new Date(server.updatedAt).getTime() >
          new Date(entry.queuedAt).getTime()
      ) {
        return {
          status: 'conflict',
          message: `The server copy of this ${slug} is newer than your queued change. Discard this change to keep the server version.`,
        }
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
        return {
          status: 'conflict',
          message: `The server rejected this change (conflict). Review and retry, or discard it.`,
        }
      }
      if (res.status === 401 || res.status === 403) {
        return {
          status: 'conflict',
          message: `Sign-in expired — sign in again, then retry this change.`,
        }
      }
      const data = await res.json().catch(() => ({}))
      const msg =
        data?.errors?.[0]?.message ||
        data?.message ||
        data?.error ||
        `HTTP ${res.status}`
      return {
        status: 'conflict',
        message: `The server rejected this change: ${msg}`,
      }
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
    return { status: 'pushed' }
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
   * keeps the remaining queue. Server rejections mark the entry CONFLICTED
   * and keep it in the outbox (nothing is dropped) — the user reviews it in
   * the sync banner and can retry, edit, or discard it.
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
      // Already-conflicted entries are blocked — never auto-retry them.
      if (entry.conflict) continue
      try {
        const outcome = await this.apply(entry, idMap, freshIds)
        if (outcome.status === 'pushed') {
          pushed++
          processed++
          await this.db.remove(entry.seq)
        } else {
          conflicts++
          processed++
          await this.db.markConflict(entry.seq, outcome.message)
        }
      } catch (err) {
        if (isNetworkError(err)) break // still offline — retry later
        processed++
        conflicts++
        await this.db
          .markConflict(
            entry.seq,
            `Could not sync this change: ${msg(err)}`,
          )
          .catch(() => {})
      }
    }
    await this.refreshCounts()
    this.lastSyncAt = new Date().toISOString()
    this.emit()
    if (pushed > 0) {
      pushToast(
        'success',
        `${pushed} change${pushed === 1 ? '' : 's'} synced`,
        'Your queued changes were pushed to the server.',
      )
    }
    if (conflicts > 0) {
      pushToast(
        'warning',
        `${conflicts} change${conflicts === 1 ? '' : 's'} could not sync`,
        'The server rejected them — review them in the banner above to retry, edit, or discard.',
      )
    }
    return { pushed, conflicts }
  }

  /** Removes a conflicted (or any) queued entry — the user chose to drop it. */
  async discard(seq: number): Promise<void> {
    await this.db.remove(seq)
    await this.refreshCounts()
    pushToast('info', 'Queued change discarded')
  }

  /** Clears the conflict flag so the entry is attempted on the next flush. */
  async retry(
    seq: number,
  ): Promise<{ pushed: number; conflicts: number }> {
    await this.db.unmarkConflict(seq)
    await this.refreshCounts()
    return this.flush()
  }

  async getEntry(seq: number): Promise<OutboxEntry | null> {
    const entries = await this.db.pending()
    return entries.find((e) => e.seq === seq) ?? null
  }

  /** Queued entries the server rejected — surfaced in the sync banner. */
  async listConflicts(): Promise<OutboxEntry[]> {
    const entries = await this.db.pending()
    return entries.filter((e) => e.conflict)
  }

  /** Full manual/background sync: flush queued writes, pull collections,
   * warm the core reports. Shared by the header button and the banner.
   * Re-entrant calls (e.g. the 30s loop firing while a slow pull is still
   * running) are skipped so requests never pile up and pin the in-flight
   * counter. */
  async syncAll(): Promise<void> {
    if (this.syncingAll) return
    this.syncingAll = true
    try {
      await this.flush()
      for (const slug of SYNC_COLLECTIONS) {
        try {
          await this.pull(slug)
        } catch {
          // collection may not exist in this deployment
        }
      }
      try {
        await this.warmReports()
      } catch {
        // best-effort — reports still fall back to the cache offline
      }
    } finally {
      this.syncingAll = false
    }
  }

  /**
   * Background refresh of one collection: incremental cursor pull that
   * upserts changed documents into the read cache. Throttled so the many
   * cache-first reads on a page don't each trigger a network fetch, and
   * silent on failure (offline) — the cached copy stays authoritative.
   */
  async refresh(collection: string, tenant?: string): Promise<void> {
    const now = Date.now()
    const refreshKey = tenant ? `${tenant}:${collection}` : collection
    if (now - (this.lastRefresh[refreshKey] ?? 0) < 10_000) return
    this.lastRefresh[refreshKey] = now
    try {
      await this.pull(collection, tenant)
    } catch (err) {
      // Offline or collection missing — the cached copy remains valid. Flag
      // a network failure so the sync pill shows the real connection state.
      if (isNetworkError(err)) this.setOnline(false)
    }
  }

  /**
   * Tenant-partitioned cache bucket. The cache table is keyed by collection
   * string, so prefix it with the tenant scope to keep one illaka's cached
   * rows from leaking into another's views (and to make reads truly filtered).
   */
  private scopedKey(collection: string, tenant?: string): string {
    return tenant ? `${tenant}:${collection}` : collection
  }

  private async runWithSyncing<T>(fn: () => Promise<T>): Promise<T> {
    this.syncingCount++
    this.emit()
    try {
      return await fn()
    } finally {
      this.syncingCount = Math.max(0, this.syncingCount - 1)
      this.emit()
    }
  }

  /**
   * fetch with a hard timeout. A background pull must never hang forever —
   * a half-open connection or slow server would otherwise pin the sync
   * engine's in-flight counter and leave the "Refreshing" indicator on
   * indefinitely. Aborts throw a TypeError so the offline path (and the
   * online/offline state) treats them like a network failure.
   */
  private async fetchWithTimeout(
    path: string,
    init?: RequestInit,
    timeoutMs = 15_000,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(path, { ...init, signal: controller.signal })
    } catch (err) {
      if (isAbortError(err)) throw new TypeError('Network timeout')
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
  /**
   * Incremental pull for one collection using an updatedAt cursor, upserting
   * each changed document into the local cache. Uses the bracket where form
   * (this Payload build silently ignores the JSON form) and depth 1 so cached
   * documents carry the populated relations the UI renders.
   *
   * When `tenant` is provided, cursor/pulled keys and the cached rows are
   * scoped to that tenant so a shared device never leaks another illaka's
   * data — the fetch is also filtered server-side with `where[tenant][equals]`.
   */
  async pull(collection: string, tenant?: string): Promise<number> {
    return this.runWithSyncing(() => this.doPull(collection, tenant))
  }

  private async doPull(collection: string, tenant?: string): Promise<number> {
    const scopePrefix = tenant ? `${tenant}:` : ''
    const cursorKey = `cursor:${scopePrefix}${collection}`
    const pulledKey = `pulled:${scopePrefix}${collection}`
    const cursor = await this.db.getKey(cursorKey)
    const params = new URLSearchParams({
      limit: '1000',
      depth: '1',
      sort: 'updatedAt',
    })
    if (tenant) {
      params.append('tenant', tenant)
      params.append('where[tenant][equals]', tenant)
    }
    if (cursor) params.append('where[updatedAt][greater_than]', cursor)
    const res = await this.fetchWithTimeout(
      `${API_BASE}/api/${collection}?${params}`,
      { credentials: 'include' },
    )
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
    const changed = await this.writeChanged(
      this.scopedKey(collection, tenant),
      docs,
    )
    if (latest) await this.db.setKey(cursorKey, latest)
    // Marks the collection as pulled so even an empty one serves from cache
    // instead of re-hitting the network on every view.
    await this.db.setKey(pulledKey, '1')
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
    tenant?: string,
  ): Promise<void> {
    await this.db.setKey(`pulled:${this.scopedKey(collection, tenant)}`, '1')
    const changed = await this.writeChanged(
      this.scopedKey(collection, tenant),
      docs,
    )
    if (changed > 0) this.bumpCache()
  }

  /**
   * Drops the cached copy of a collection (and its pull cursor) so the next
   * read hits the server. Called after successful writes so the UI never
   * serves a stale list right after the user saved something.
   */
  async invalidate(collection: string, tenant?: string): Promise<void> {
    await this.db.clearCache(this.scopedKey(collection, tenant))
    const scopePrefix = tenant ? `${tenant}:` : ''
    await this.db.deleteKey(`cursor:${scopePrefix}${collection}`)
    await this.db.deleteKey(`pulled:${scopePrefix}${collection}`)
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
    return this.runWithSyncing(() => this.doWarmReports())
  }

  private async doWarmReports(): Promise<void> {
    const now = Date.now()
    if (now - this.lastReportWarm < 60_000) return
    this.lastReportWarm = now
    for (const name of CORE_REPORTS) {
      const path = `/${REPORT_SLUG}/${name}`
      try {
        const res = await this.fetchWithTimeout(`${API_BASE}/api${path}`, {
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
    tenant?: string,
  ): Promise<{ docs: Record<string, unknown>[]; totalDocs: number } | null> {
    const docs = await this.db.cacheList(this.scopedKey(slug, tenant))
    const scopePrefix = tenant ? `${tenant}:` : ''
    const pulled = await this.db.getKey(`pulled:${scopePrefix}${slug}`)
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
