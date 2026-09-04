export interface OutboxEntry {
  seq: number
  method: string
  path: string
  body: unknown
  queuedAt: string
  /** Local id assigned to a queued create, mapped to the server id on flush. */
  localId?: string
  /** Set when the server rejected the write (validation, 4xx, stale copy). The
   * entry is KEPT in the outbox marked as conflicted instead of dropped, so
   * the user can review the reason and retry, edit, or discard it. */
  conflict?: { message: string; at: string }
}

export interface SyncState {
  online: boolean
  /** Non-conflicted queued writes waiting to sync. */
  pending: number
  /** Queued writes the server rejected — kept for review, not auto-retried. */
  conflicts: number
  lastSyncAt: string | null
  banners: { message: string; at: string }[]
  /** Bumped whenever the read cache gains or changes documents, so views
   * subscribed to it can re-read locally instead of hitting the network. */
  cacheVersion: number
  /** True when a report was served from the local cache (offline). */
  reportsStale: boolean
  /** Epoch ms of the last report successfully fetched from the server. */
  lastReportSyncAt: number | null
  /** Number of network requests (pull/sync) currently in flight. >0 while
   * the server is being talked to — drives the "refreshing" indicator. */
  syncingCount: number
  /** Epoch ms of the next scheduled automatic sync, or null when none is
   * scheduled (e.g. offline). Drives the "Resync in Xs" countdown. */
  nextSyncAt: number | null
}

export interface OfflineDb {
  ready(): Promise<void>
  getKey(key: string): Promise<string | null>
  setKey(key: string, value: string): Promise<void>
  deleteKey(key: string): Promise<void>
  enqueue(entry: Omit<OutboxEntry, 'seq'>): Promise<void>
  pending(): Promise<OutboxEntry[]>
  pendingCount(): Promise<number>
  remove(seq: number): Promise<void>
  markConflict(seq: number, message: string): Promise<void>
  unmarkConflict(seq: number): Promise<void>
  cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void>
  cacheList(collection: string): Promise<Record<string, unknown>[]>
  cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null>
  clearCache(collection: string): Promise<void>
}
