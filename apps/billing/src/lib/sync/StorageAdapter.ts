/**
 * StorageAdapter: abstraction over local storage for the sync engine.
 * Both IndexedDB (web) and SQLite (Tauri) implement this interface.
 */

export interface SyncOperation {
  seq?: number
  op: 'create' | 'update' | 'delete'
  collection: string
  id?: number | string
  localId?: string
  data?: Record<string, unknown>
  queuedAt: string
  conflict?: { message: string; at: string }
}

export interface StorageAdapter {
  /** Initialize the storage backend (open DB, create tables, etc.) */
  ready(): Promise<void>

  // ── Outbox (write queue) ──────────────────────────────────────

  /** Append an operation to the outbox */
  enqueue(op: SyncOperation): Promise<void>

  /** Get all pending (non-conflicted) operations in order */
  getPending(): Promise<SyncOperation[]>

  /** Get all operations including conflicted ones */
  getAll(): Promise<SyncOperation[]>

  /** Remove an operation from the outbox by seq */
  removePending(seq: number): Promise<void>

  /** Mark an operation as conflicted */
  markConflict(seq: number, reason: string): Promise<void>

  /** Clear the conflict flag so it can be retried */
  unmarkConflict(seq: number): Promise<void>

  /** Count of pending non-conflicted operations */
  pendingCount(): Promise<number>

  /** Get a single entry by seq */
  getEntry(seq: number): Promise<SyncOperation | null>

  // ── Cache (read store) ───────────────────────────────────────

  /** Upsert a document into the collection cache */
  upsert(collection: string, doc: Record<string, unknown>): Promise<void>

  /** Get a single cached document */
  get(collection: string, id: number | string): Promise<Record<string, unknown> | null>

  /** List all documents in a collection */
  list(collection: string): Promise<Record<string, unknown>[]>

  /** Delete a single document from cache */
  remove(collection: string, id: number | string): Promise<void>

  /** Clear all cached data for a collection */
  clearCollection(collection: string): Promise<void>

  // ── Key-value store ──────────────────────────────────────────

  /** Get a key-value pair */
  getKey(key: string): Promise<string | null>

  /** Set a key-value pair */
  setKey(key: string, value: string): Promise<void>

  /** Delete a key */
  deleteKey(key: string): Promise<void>

  // ── ID mapping (local → server) ──────────────────────────────

  /** Map a local temporary ID to a server-assigned ID */
  mapLocalToServer(localId: string, serverId: number): Promise<void>

  /** Get the server ID for a local ID (returns null if not mapped) */
  getServerId(localId: string): Promise<number | null>

  /** Get the full ID map as a plain object */
  getIdMap(): Promise<Record<string, number>>

  /** Replace the entire ID map */
  setIdMap(map: Record<string, number>): Promise<void>
}
