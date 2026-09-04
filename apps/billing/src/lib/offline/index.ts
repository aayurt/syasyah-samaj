import { useEffect, useState } from 'react'
import { SyncEngine as NewSyncEngine } from '../sync/SyncEngine'
import { IndexedDbAdapter } from '../sync/adapters/IndexedDbAdapter'
import type { SyncState } from '../sync/SyncEngine'
import type { OutboxEntry, SyncState as OldSyncState } from './types'

/**
 * Compatibility wrapper: uses the new SyncEngine + StorageAdapter under the
 * hood but exposes the old getEngine()/useSyncState() API so existing call
 * sites continue to work unchanged.
 */

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI__' in window

let engine: CompatibilityEngine | null = null

/** Get or create the singleton engine. */
export function getEngine(): CompatibilityEngine {
  if (!engine) {
    engine = new CompatibilityEngine()
  }
  return engine
}

/**
 * Wraps the new SyncEngine and provides the old SyncEngine's public API
 * so existing code (SyncBanner, Vouchers, api.ts, auth.ts) keeps working.
 */
class CompatibilityEngine {
  private inner: NewSyncEngine | null = null
  private adapter: IndexedDbAdapter | null = null
  private initPromise: Promise<void> | null = null
  /** Current tenant ID — set by the React provider via setTenant().
   *  The SyncEngine uses this to scope cache keys (e.g. C00:documents). */
  private _tenant: string = ''

  /** Called by TenantProvider when the tenant changes. */
  setTenant(tenant: string) {
    this._tenant = tenant
  }

  private async ensure(): Promise<NewSyncEngine> {
    if (this.inner) return this.inner
    if (this.initPromise) {
      await this.initPromise
      return this.inner!
    }
    this.initPromise = (async () => {
      this.adapter = new IndexedDbAdapter()
      await this.adapter.ready()
      this.inner = new NewSyncEngine(
        this.adapter,
        '',
        (collection) => (this._tenant ? `${this._tenant}:${collection}` : collection),
        // Background flushes (debounced auto-flush, periodic sync, tab
        // visibility, init replay) run inside the engine without passing
        // through this wrapper — bump the version so cache-first pages
        // re-read rows whose `local-*` id was just mapped to the server id.
        () => {
          this._cacheVersion++
        },
      )
      await this.inner.init()
    })()
    await this.initPromise
    return this.inner!
  }

  // ── SyncState ─────────────────────────────────────────────────

  getState(): OldSyncState {
    if (!this.inner) {
      return {
        online: true,
        pending: 0,
        conflicts: 0,
        lastSyncAt: null,
        banners: [],
        cacheVersion: 0,
        reportsStale: false,
        lastReportSyncAt: null,
        syncingCount: 0,
      }
    }
    const s = this.inner.getState()
    return {
      online: s.online,
      pending: s.pending,
      conflicts: s.conflicts,
      lastSyncAt: s.lastSyncAt,
      banners: [],
      cacheVersion: this._cacheVersion,
      reportsStale: false,
      lastReportSyncAt: null,
      syncingCount: s.syncing ? 1 : 0,
    }
  }

  private _cacheVersion = 0

  setOnline(online: boolean): void {
    if (this.inner) this.inner.setOnline(online)
  }

  subscribe(fn: (s: OldSyncState) => void): () => void {
    // Wrap the new engine's subscribe to emit old-state shape
    let lastState = this.getState()
    const unsub = (() => {
      // Polling subscribe — the new engine doesn't expose the old state shape,
      // so we poll every 2s and emit on change. This is a temporary shim.
      const timer = setInterval(() => {
        const next = this.getState()
        if (
          next.online !== lastState.online ||
          next.pending !== lastState.pending ||
          next.conflicts !== lastState.conflicts ||
          next.cacheVersion !== lastState.cacheVersion ||
          next.syncingCount !== lastState.syncingCount
        ) {
          lastState = next
          fn(next)
        }
      }, 2000)
      return () => clearInterval(timer)
    })()
    return unsub
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.ensure()
  }

  // ── Queue operations ──────────────────────────────────────────

  newLocalId(): string {
    const rnd =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10)
    return `local-${rnd}`
  }

  async offlineRequest(
    method: string,
    path: string,
    body: unknown,
  ): Promise<unknown> {
    const engine = await this.ensure()
    const clean = path.split('?')[0].replace(/^\/+|\/+$/g, '')
    const parts = clean.split('/')

    // Detect custom endpoints: /collection/id/action (3+ segments)
    // e.g., /documents/123/post, /documents/123/void
    const isCustomEndpoint = parts.length >= 3

    if (isCustomEndpoint) {
      // Queue as a custom op — the sync engine sends it as an individual
      // fetch during flush, not through the batch sync endpoint.
      const collName = parts[0]
      const rawId = parts[1] // may be local-xxx or a numeric server ID
      const action = parts[2] // e.g., 'post', 'void', 'reopen'
      // Store the raw ID so the flush handler can resolve local→server.
      await engine.queue({
        op: 'create' as const, // custom ops are always POST
        collection: collName,
        id: rawId,
        data: { _action: action, ...(body as Record<string, unknown>) },
      })
      this._cacheVersion++
      // Return the resolved path for the caller (for optimistic UI)
      return { doc: { id: rawId }, queued: true }
    }

    // Standard CRUD: /collection or /collection/id
    const collection = parts[0] || ''
    const id = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : undefined

    const result = await engine.offlineWrite(
      method,
      collection,
      id,
      body as Record<string, unknown>,
    )
    this._cacheVersion++
    return { doc: { id: result.id }, queued: result.queued }
  }

  // ── Sync ──────────────────────────────────────────────────────

  async flush(): Promise<{ pushed: number; conflicts: number }> {
    const engine = await this.ensure()
    const result = await engine.syncAll()
    this._cacheVersion++
    return {
      pushed: result?.applied?.length ?? 0,
      conflicts: result?.conflicts?.length ?? 0,
    }
  }

  // ── Outbox management ─────────────────────────────────────────

  async pendingCount(): Promise<number> {
    const engine = await this.ensure()
    return engine.getState().pending
  }

  async getEntry(seq: number): Promise<OutboxEntry | null> {
    const engine = await this.ensure()
    const entry = await engine.getEntry(seq)
    if (!entry) return null
    return {
      seq: entry.seq ?? 0,
      method: entry.op === 'create' ? 'POST' : entry.op === 'update' ? 'PATCH' : 'DELETE',
      path: `/${entry.collection}/${entry.id ?? ''}`,
      body: entry.data,
      queuedAt: entry.queuedAt,
      localId: entry.localId,
      conflict: entry.conflict,
    }
  }

  async listConflicts(): Promise<OutboxEntry[]> {
    const engine = await this.ensure()
    const entries = await engine.getConflicts()
    return entries.map((e) => ({
      seq: e.seq ?? 0,
      method: e.op === 'create' ? 'POST' : e.op === 'update' ? 'PATCH' : 'DELETE',
      path: `/${e.collection}/${e.id ?? ''}`,
      body: e.data,
      queuedAt: e.queuedAt,
      localId: e.localId,
      conflict: e.conflict,
    }))
  }

  async discard(seq: number): Promise<void> {
    const engine = await this.ensure()
    await engine.discard(seq)
    this._cacheVersion++
  }

  async retry(seq: number): Promise<void> {
    const engine = await this.ensure()
    await engine.retry(seq)
    this._cacheVersion++
  }

  async fetchServerVersion(
    path: string,
  ): Promise<Record<string, unknown> | null> {
    // Use the old approach: fetch directly from the API
    try {
      const res = await fetch(path, { credentials: 'include' })
      if (!res.ok) return null
      const data = await res.json()
      return data?.doc ?? data ?? null
    } catch {
      return null
    }
  }

  async forceApply(
    entry: OutboxEntry,
    mergedBody: unknown,
  ): Promise<{ status: string; message?: string }> {
    try {
      const res = await fetch(entry.path, {
        method: entry.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedBody),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { status: 'conflict', message: data?.error || `HTTP ${res.status}` }
      }
      const engine = await this.ensure()
      await engine.discard(entry.seq)
      this._cacheVersion++
      return { status: 'pushed' }
    } catch (err) {
      return { status: 'conflict', message: err instanceof Error ? err.message : String(err) }
    }
  }

  async updateEntry(seq: number, newBody: unknown): Promise<void> {
    const engine = await this.ensure()
    await engine.updateEntry(seq, newBody as Record<string, unknown>)
  }

  // ── KV passthroughs ───────────────────────────────────────────

  async getKey(key: string): Promise<string | null> {
    const engine = await this.ensure()
    // Access the adapter directly for KV operations
    return this.adapter!.getKey(key)
  }

  async setKey(key: string, value: string): Promise<void> {
    await this.ensure()
    await this.adapter!.setKey(key, value)
  }

  async deleteKey(key: string): Promise<void> {
    await this.ensure()
    await this.adapter!.deleteKey(key)
  }

  // ── Report cache ──────────────────────────────────────────────

  async readReport(key: string): Promise<{ payload: unknown; syncedAt: number } | null> {
    const raw = await this.getKey(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  async writeReport(key: string, payload: unknown): Promise<void> {
    await this.setKey(key, JSON.stringify({ payload, syncedAt: Date.now() }))
  }

  markReportsSynced(): void {
    // No-op — the new engine handles this differently
  }

  markReportsStale(): void {
    // No-op — the new engine handles this differently
  }

  // ── Pull / cache operations ───────────────────────────────────

  /**
   * Pull changes from the server via POST /api/sync.
   * Single request: sends pending ops + fetches all changes since lastSyncAt.
   * Applies changes to IndexedDB and bumps cacheVersion.
   */
  async syncAll(): Promise<void> {
    const engine = await this.ensure()
    await engine.syncAll()
    this._cacheVersion++
  }

  /**
   * Pull only: single POST /api/sync with no outgoing ops.
   * Returns the number of changed documents.
   */
  async pull(tenant?: string): Promise<number> {
    // BackgroundSync calls pull() on mount and every 5 minutes expecting a
    // push+pull. When the outbox has entries, delegate to the engine so
    // queued writes are not stranded until the 60s periodic sync.
    try {
      const engine = await this.ensure()
      const pending = await this.adapter!.pendingCount().catch(() => 0)
      if (pending > 0) {
        const result = await engine.syncAll()
        return result?.changes?.length ?? 0
      }
    } catch {
      // fall through to the lightweight pull below
    }
    try {
      const lastSyncAt = await this.getKey('lastSyncAt')
      const body: Record<string, unknown> = {
        lastSyncAt: lastSyncAt || undefined,
        operations: [],
      }
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) return 0
      const data = await res.json()
      // Apply server changes to local cache
      const changes = data.changes || []
      for (const change of changes) {
        if (change.data?.id) {
          const col = change.collection
          await this.adapter!.upsert(col, change.data)
          // Mark collection as pulled
          await this.setKey(`pulled:${col}`, '1')
        }
      }
      // Update sync cursor
      if (data.serverTime) {
        await this.setKey('lastSyncAt', data.serverTime)
      }
      if (changes.length > 0) this._cacheVersion++
      return changes.length
    } catch {
      return 0
    }
  }

  async readCollection(
    slug: string,
    tenant?: string,
  ): Promise<{ docs: Record<string, unknown>[]; totalDocs: number } | null> {
    const pulled = await this.getKey(`pulled:${tenant ? `${tenant}:` : ''}${slug}`)
    if (!pulled) return null
    const docs = await this.adapter!.list(tenant ? `${tenant}:${slug}` : slug)
    return { docs, totalDocs: docs.length }
  }

  async readDoc(slug: string, id: string): Promise<Record<string, unknown> | null> {
    return this.adapter!.get(slug, id)
  }

  /** Resolve a `local-*` placeholder to its server id once the flush mapped it. */
  async resolveLocalId(localId: string): Promise<number | null> {
    await this.ensure()
    return this.adapter!.getServerId(localId)
  }

  async invalidate(collection: string, tenant?: string): Promise<void> {
    await this.adapter!.clearCollection(tenant ? `${tenant}:${collection}` : collection)
    await this.deleteKey(`cursor:${tenant ? `${tenant}:` : ''}${collection}`)
    await this.deleteKey(`pulled:${tenant ? `${tenant}:` : ''}${collection}`)
  }

  async warmCache(
    collection: string,
    docs: Record<string, unknown>[],
    tenant?: string,
  ): Promise<void> {
    const key = tenant ? `${tenant}:${collection}` : collection
    await this.setKey(`pulled:${key}`, '1')
    for (const doc of docs) {
      await this.adapter!.upsert(key, doc)
    }
    this._cacheVersion++
  }

  async warmReports(): Promise<void> {
    // No-op — reports are fetched on demand
  }
}

/** React hook reflecting the engine's sync state. */
export function useSyncState(): OldSyncState {
  const e = getEngine()
  const [state, setState] = useState<OldSyncState>(() => e.getState())

  useEffect(() => {
    void e.init()
    return e.subscribe(setState)
  }, [e])

  return state
}
