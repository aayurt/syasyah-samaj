import type { StorageAdapter, SyncOperation } from './StorageAdapter'

/**
 * SyncResult: the response from POST /api/sync
 */
export interface SyncResult {
  serverTime: string
  applied: Array<{
    index: number
    localId?: string
    serverId?: number
    status: string
  }>
  conflicts: Array<{
    index: number
    reason: string
  }>
  changes: Array<{
    op: string
    collection: string
    data: Record<string, unknown>
  }>
}

/**
 * SyncState: current state of the sync engine for UI display
 */
export interface SyncState {
  online: boolean
  pending: number
  conflicts: number
  lastSyncAt: string | null
  syncing: boolean
}

/**
 * SyncEngine: shared sync logic for both Web (IndexedDB) and Tauri (SQLite).
 * Only the StorageAdapter differs between platforms.
 */
export class SyncEngine {
  private online = true
  private syncing = false
  private lastSyncAt: string | null = null
  private listeners = new Set<(state: SyncState) => void>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private consecutiveFailures = 0

  /** Maps a plain collection name (from server) to the local cache key.
   *  Defaults to identity (plain name). The wrapper overrides this to
   *  add tenant-scoping, e.g. `documents` → `C00:documents`. */
  private _cacheKey: (collection: string) => string = (c) => c

  constructor(
    private storage: StorageAdapter,
    private apiBase: string = '',
    cacheKey?: (collection: string) => string,
    /** Fired after a flush changed cached rows (ids mapped / server changes
     *  applied / custom actions succeeded) — lets the wrapper bump its cache
     *  version so cache-first pages re-read instead of holding stale ids. */
    private onCacheChanged?: () => void,
  ) {
    if (cacheKey) this._cacheKey = cacheKey
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.storage.ready()
    this.lastSyncAt = await this.storage.getKey('lastSyncAt')
    this.startHeartbeat()
    this.startPeriodicSync()
    // Returning to the tab is a strong signal the user wants fresh data:
    // flush queued writes and pull server changes (guarded by `syncing`).
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.online) {
          void this.syncAll().catch(() => {
            // offline — entries stay queued, heartbeat will retry
          })
        }
      })
    }
    // A page reload kills the debounced flush timer of the previous session,
    // so any writes queued before the navigation would strand in the outbox
    // until the 60s periodic sync. Re-queue them on startup (storage is
    // shared across reloads via IndexedDB/SQLite).
    try {
      const queued = await this.storage.pendingCount()
      if (queued > 0) this.scheduleFlush(250)
    } catch {
      // storage unavailable — periodic sync will retry
    }
    this.emit()
  }

  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.syncTimer) clearInterval(this.syncTimer)
  }

  // ── State ─────────────────────────────────────────────────────

  getState(): SyncState {
    return {
      online: this.online,
      pending: this.pendingHint,
      conflicts: this.conflictsHint,
      lastSyncAt: this.lastSyncAt,
      syncing: this.syncing,
    }
  }

  private pendingHint = 0
  private conflictsHint = 0

  private async refreshCounts(): Promise<void> {
    try {
      const all = await this.storage.getAll()
      this.pendingHint = all.filter((e) => !e.conflict).length
      this.conflictsHint = all.filter((e) => e.conflict).length
      this.emit()
    } catch {
      // storage unavailable — keep previous hints
    }
  }

  subscribe(fn: (state: SyncState) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    const state = this.getState()
    for (const fn of this.listeners) {
      try {
        fn(state)
      } catch {
        // throwing listener must not break others
      }
    }
  }

  setOnline(online: boolean) {
    if (this.online === online) return
    this.online = online
    this.emit()
    // Coming back online — push anything that queued while we were away.
    if (online) this.scheduleFlush(500)
  }

  /**
   * Debounced auto-flush: shortly after any write, push the outbox to the
   * server when we're online. Keeps the offline-first UX (writes resolve
   * instantly from the local cache) while making the server sync nearly
   * immediate in the normal online case — instead of waiting for the
   * periodic sync. Offline callers are ignored: entries stay queued and
   * the online transition (or manual resync) flushes them later.
   */
  scheduleFlush(delayMs = 1500) {
    if (!this.online) return
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      if (!this.syncing) void this.syncAll().catch(() => { /* stay queued */ })
    }, delayMs)
  }

  // ── Heartbeat (online detection) ──────────────────────────────

  private startHeartbeat() {
    if (this.heartbeatTimer) return
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeat()
    }, 30_000)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnline(true))
      window.addEventListener('offline', () => {
        this.consecutiveFailures++
        if (this.consecutiveFailures >= 2) this.setOnline(false)
      })
    }
  }

  private async heartbeat() {
    try {
      const res = await fetch(`${this.apiBase}/api/globals/billing-settings?depth=0&limit=1`, {
        credentials: 'include',
        signal: AbortSignal.timeout(10_000),
      })
      if (res.ok) {
        this.consecutiveFailures = 0
        if (!this.online) this.setOnline(true)
      } else {
        this.consecutiveFailures++
        if (this.consecutiveFailures >= 2) this.setOnline(false)
      }
    } catch {
      this.consecutiveFailures++
      if (this.consecutiveFailures >= 2) this.setOnline(false)
    }
  }

  // ── Periodic sync ─────────────────────────────────────────────

  private startPeriodicSync() {
    if (this.syncTimer) return
    this.syncTimer = setInterval(() => {
      if (this.online && !this.syncing) {
        void this.syncAll()
      }
    }, 60_000)
  }

  // ── Queue operations ──────────────────────────────────────────

  newLocalId(): string {
    const rnd =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10)
    return `local-${rnd}`
  }

  /**
   * Queue a write for later sync. Returns a local ID for creates.
   */
  async queue(
    op: Omit<SyncOperation, 'queuedAt'>,
  ): Promise<{ localId?: string }> {
    const entry: SyncOperation = {
      ...op,
      queuedAt: new Date().toISOString(),
    }

    // Assign local ID for creates
    if (op.op === 'create' && !op.localId) {
      entry.localId = this.newLocalId()
    }

    await this.storage.enqueue(entry)
    await this.refreshCounts()

    // Online: sync to the server within seconds, not at the next periodic
    // sync. Debounced so a burst of writes results in one round-trip.
    this.scheduleFlush()
    return { localId: entry.localId }
  }

  /**
   * Queue an offline write with optimistic cache update.
   * The UI sees the change immediately while offline.
   */
  async offlineWrite(
    method: string,
    collection: string,
    id: number | string | undefined,
    body: Record<string, unknown>,
  ): Promise<{ id?: string | number; queued: boolean }> {
    const op = method === 'DELETE' ? 'delete' : id ? 'update' : 'create'

    const entry: SyncOperation = {
      op: op as 'create' | 'update' | 'delete',
      collection,
      id,
      data: body,
      queuedAt: new Date().toISOString(),
    }

    if (op === 'create') {
      entry.localId = this.newLocalId()
    }

    await this.storage.enqueue(entry)

    // Optimistic cache update
    if (op === 'create' && entry.localId) {
      await this.storage.upsert(collection, {
        ...body,
        id: entry.localId,
        _pendingSync: true,
      })
    } else if (op === 'update' && id) {
      const existing = await this.storage.get(collection, id)
      if (existing) {
        await this.storage.upsert(collection, {
          ...existing,
          ...body,
          _pendingSync: true,
        })
      }
    } else if (op === 'delete' && id) {
      await this.storage.remove(collection, id)
    }

    await this.refreshCounts()
    // Online: sync to the server within seconds (see scheduleFlush).
    this.scheduleFlush()
    return { id: entry.localId, queued: true }
  }

  // ── Sync (push + pull) ────────────────────────────────────────

  /**
   * Flush all pending operations to the server and pull changes.
   * Single HTTP round-trip for batch operations.
   */
  async syncAll(): Promise<SyncResult | null> {
    if (this.syncing) return null
    this.syncing = true
    this.emit()

    try {
      const result = await this.flush()
      return result
    } finally {
      this.syncing = false
      this.emit()
    }
  }

  /**
   * Push all pending operations to the server. Standard CRUD ops are
   * batched via POST /api/sync. Custom endpoints (/:id/post, /:id/void, etc.)
   * are sent as individual fetches since they have server-side business logic.
   *
   * Multi-tab safe: the Web Locks API ensures only one tab replays the
   * shared IndexedDB outbox at a time — without this, two tabs could push
   * the same entry twice (double-posted vouchers).
   */
  private async flush(): Promise<SyncResult> {
    const locks = (navigator as Navigator & {
      locks?: {
        request: (name: string, cb: () => Promise<SyncResult>) => Promise<SyncResult>
      }
    }).locks
    // Browsers without Web Locks flush directly — same behavior as before.
    if (!locks) return this.doFlush()
    return locks.request('syasya-outbox-flush', () => this.doFlush())
  }

  private async doFlush(): Promise<SyncResult> {
    const pending = await this.storage.getPending()

    // Split: standard CRUD vs custom endpoints
    // Standard CRUD: creates (op=create, no id), updates (op=update, has id), deletes (op=delete, has id)
    // Custom endpoints: create ops WITH an id AND _action in data (e.g. /documents/:id/post)
    const crudOps: typeof pending = []
    const customOps: typeof pending = []
    for (const p of pending) {
      const isCustomCreate = p.op === 'create' && p.id && p.data?._action
      if (isCustomCreate) {
        customOps.push(p)
      } else {
        crudOps.push(p)
      }
    }

    // 1. Batch standard CRUD via sync endpoint
    const body = {
      lastSyncAt: this.lastSyncAt,
      operations: crudOps.map((p) => ({
        op: p.op,
        collection: p.collection,
        id: p.id,
        localId: p.localId,
        data: p.data,
      })),
    }

    let res: Response
    try {
      res = await fetch(`${this.apiBase}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      if (err instanceof TypeError) {
        this.setOnline(false)
        return {
          serverTime: new Date().toISOString(),
          applied: [],
          conflicts: [],
          changes: [],
        }
      }
      throw err
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || `Sync failed: HTTP ${res.status}`)
    }

    const result: SyncResult = await res.json()

    // ── Process applied CRUD operations ─────────────────────────

    for (const applied of result.applied) {
      const entry = crudOps[applied.index]
      if (!entry) continue

      // Map local ID → server ID for creates
      if (applied.localId && applied.serverId) {
        await this.storage.mapLocalToServer(applied.localId, applied.serverId)

        // Replace the `local-*` row with the server-id row in every cache
        // key that holds it. The optimistic create is stored under the plain
        // collection AND (when a tenant is set) the tenant-scoped read key
        // that api() serves cache-first lists from — both must be updated or
        // re-reads keep showing the stale local id.
        for (const key of new Set([entry.collection, this._cacheKey(entry.collection)])) {
          const localDoc = await this.storage.get(key, applied.localId)
          if (!localDoc) continue
          await this.storage.remove(key, applied.localId)
          await this.storage.upsert(key, {
            ...localDoc,
            id: applied.serverId,
            _pendingSync: false,
          })
        }
      }

      // Remove from outbox
      if (entry.seq !== undefined) {
        await this.storage.removePending(entry.seq)
      }
    }

    // ── Process conflicts ────────────────────────────────────────

    for (const conflict of result.conflicts) {
      const entry = crudOps[conflict.index]
      if (!entry || entry.seq === undefined) continue

      await this.storage.markConflict(entry.seq, conflict.reason)
    }

    // ── Flush custom endpoints (/:id/post, /:id/void, etc.) ────
    // These have server-side business logic and can't be batched.
    let customApplied = false
    for (const entry of customOps) {
      try {
        // The collection field stores the full path for custom endpoints,
        // e.g., 'documents/local-0170b4e3/post'. Parse it and replace
        // the local ID with the mapped server ID.
        // Custom ops now store collection as the collection name,
        // id as the raw local/server ID, and action in data._action.
        // Legacy format: collection = 'documents/local-xxx/post' (fallback).
        let collName: string
        let rawId: string | undefined
        let action: string | undefined
        if (entry.id != null && entry.data?._action) {
          // New format: collection, id, _action are separate
          collName = entry.collection
          rawId = String(entry.id)
          action = String(entry.data._action)
        } else {
          // Legacy format: collection = 'collection/id/action'
          const collParts = entry.collection.split('/')
          collName = collParts[0]
          rawId = collParts[1]
          action = collParts[2]
        }

        if (!rawId || rawId === 'undefined') {
          if (entry.seq != null) {
            await this.storage.markConflict(entry.seq, 'Cannot resolve document ID')
          }
          continue
        }

        // Resolve local ID → server ID
        let resolvedId: string | number = rawId
        if (rawId.startsWith('local-')) {
          const mapped = await this.storage.getServerId(rawId)
          if (mapped != null) resolvedId = mapped
        }

        const path = `/${collName}/${resolvedId}${action ? `/${action}` : ''}`
        // Strip _action from the body sent to the server
        const { _action: _, ...bodyData } = (entry.data || {}) as Record<string, unknown>
        const fetchRes = await fetch(`${this.apiBase}/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(bodyData),
          signal: AbortSignal.timeout(15_000),
        })
        if (fetchRes.ok) {
          customApplied = true
          // Remove from outbox on success
          if (entry.seq != null) {
            await this.storage.removePending(entry.seq)
          }
        } else {
          const errData = await fetchRes.json().catch(() => ({}))
          if (entry.seq != null) {
            await this.storage.markConflict(entry.seq, errData?.error || `HTTP ${fetchRes.status}`)
          }
        }
      } catch {
        // Network error — keep in outbox for retry
      }
    }

    // ── Apply server changes to local cache ─────────────────────

    for (const change of result.changes) {
      if (change.data?.id) {
        // Mirror the create-remap above: write the authoritative server doc
        // under the plain collection AND the tenant-scoped read key so both
        // cache-first readers converge on the server version.
        for (const key of new Set([change.collection, this._cacheKey(change.collection)])) {
          await this.storage.upsert(key, change.data)
        }
      }
    }

    // ── Update sync cursor ──────────────────────────────────────

    this.lastSyncAt = result.serverTime
    await this.storage.setKey('lastSyncAt', result.serverTime)

    await this.refreshCounts()

    // Tell the wrapper that cached rows changed (local ids mapped to server
    // ids, server changes applied, or a custom action succeeded) so pages
    // keyed on cacheVersion re-read and drop stale `local-*` ids.
    if (
      result.applied.length > 0 ||
      result.changes.length > 0 ||
      customApplied
    ) {
      this.onCacheChanged?.()
    }

    return result
  }

  // ── Conflict management ───────────────────────────────────────

  /** Remove a conflicted entry from the outbox */
  async discard(seq: number): Promise<void> {
    await this.storage.removePending(seq)
    await this.refreshCounts()
  }

  /** Clear conflict flag so the entry retries on next flush */
  async retry(seq: number): Promise<void> {
    await this.storage.unmarkConflict(seq)
    await this.refreshCounts()
  }

  /** Get all conflicted entries */
  async getConflicts(): Promise<SyncOperation[]> {
    const all = await this.storage.getAll()
    return all.filter((e) => e.conflict)
  }

  /** Get a single entry by seq */
  async getEntry(seq: number): Promise<SyncOperation | null> {
    return this.storage.getEntry(seq)
  }

  /** Replace an entry's body (for merge edits) and clear conflict */
  async updateEntry(seq: number, newBody: Record<string, unknown>): Promise<void> {
    const entry = await this.storage.getEntry(seq)
    if (!entry) return
    await this.storage.removePending(seq)
    const { conflict: _, ...rest } = entry
    await this.storage.enqueue({ ...rest, data: newBody })
    await this.refreshCounts()
  }

  // ── Cache reads ───────────────────────────────────────────────

  /** Read a full collection from local cache */
  async readCollection(slug: string): Promise<Record<string, unknown>[] | null> {
    const pulled = await this.storage.getKey(`pulled:${slug}`)
    if (!pulled) return null
    return this.storage.list(slug)
  }

  /**
   * Resolve a local placeholder id to its server id once the background flush
   * has mapped it (returns null when the write is still queued or failed).
   * Immediate writes (admin deletes, custom endpoints) must call this first —
   * the React state may still hold the `local-*` id the outbox returned.
   */
  async resolveLocalId(localId: string): Promise<number | null> {
    if (!localId.startsWith('local-')) return null
    return this.storage.getServerId(localId)
  }

  /** Read a single document from local cache */
  async readDoc(slug: string, id: number | string): Promise<Record<string, unknown> | null> {
    return this.storage.get(slug, id)
  }

  /** Mark a collection as pulled (cache is populated) */
  async markPulled(slug: string): Promise<void> {
    await this.storage.setKey(`pulled:${slug}`, '1')
  }

  /** Invalidate a collection's cache so next read hits the server */
  async invalidate(slug: string): Promise<void> {
    await this.storage.clearCollection(slug)
    await this.storage.deleteKey(`pulled:${slug}`)
    await this.storage.deleteKey(`cursor:${slug}`)
  }
}
