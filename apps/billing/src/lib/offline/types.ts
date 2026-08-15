export interface OutboxEntry {
  seq: number
  method: string
  path: string
  body: unknown
  queuedAt: string
  /** Local id assigned to a queued create, mapped to the server id on flush. */
  localId?: string
}

export interface SyncState {
  online: boolean
  pending: number
  lastSyncAt: string | null
  banners: { message: string; at: string }[]
  /** Bumped whenever the read cache gains or changes documents, so views
   * subscribed to it can re-read locally instead of hitting the network. */
  cacheVersion: number
  /** True when a report was served from the local cache (offline). */
  reportsStale: boolean
  /** Epoch ms of the last report successfully fetched from the server. */
  lastReportSyncAt: number | null
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
  cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void>
  cacheList(collection: string): Promise<Record<string, unknown>[]>
  cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null>
  clearCache(collection: string): Promise<void>
}
