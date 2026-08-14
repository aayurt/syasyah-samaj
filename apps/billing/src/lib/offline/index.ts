import { useEffect, useState } from 'react'
import { IndexedDb } from './indexedDb'
import { MemoryDb } from './memoryDb'
import { SyncEngine } from './syncEngine'
import type { OfflineDb, OutboxEntry, SyncState } from './types'

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI__' in window

let engine: SyncEngine | null = null

export function getEngine(): SyncEngine {
  if (!engine) {
    engine = new SyncEngine(new LazyDb())
  }
  return engine
}

/**
 * Resolves the SQLite adapter inside Tauri and the in-memory fallback
 * elsewhere, so browsers and tests never load the plugin module.
 */
class LazyDb implements OfflineDb {
  private inner: Promise<OfflineDb> | null = null

  private resolve(): Promise<OfflineDb> {
    if (!this.inner) {
      // Tauri: persistent SQLite. Browser: persistent IndexedDB. Node/tests:
      // in-memory (no IndexedDB available).
      this.inner = isTauri()
        ? import('./sqliteDb').then((m) => new m.SqliteDb())
        : typeof indexedDB !== 'undefined'
          ? Promise.resolve(new IndexedDb())
          : Promise.resolve(new MemoryDb())
    }
    return this.inner
  }

  async ready() {
    await this.resolve()
  }
  async getKey(key: string): Promise<string | null> {
    return (await this.resolve()).getKey(key)
  }
  async setKey(key: string, value: string): Promise<void> {
    return (await this.resolve()).setKey(key, value)
  }
  async deleteKey(key: string): Promise<void> {
    return (await this.resolve()).deleteKey(key)
  }
  async enqueue(entry: Omit<OutboxEntry, 'seq'>): Promise<void> {
    return (await this.resolve()).enqueue(entry)
  }
  async pending(): Promise<OutboxEntry[]> {
    return (await this.resolve()).pending()
  }
  async pendingCount(): Promise<number> {
    return (await this.resolve()).pendingCount()
  }
  async remove(seq: number): Promise<void> {
    return (await this.resolve()).remove(seq)
  }
  async cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    return (await this.resolve()).cacheUpsert(collection, doc)
  }
  async cacheList(collection: string): Promise<Record<string, unknown>[]> {
    return (await this.resolve()).cacheList(collection)
  }
  async cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null> {
    return (await this.resolve()).cacheGet(collection, id)
  }
  async clearCache(collection: string): Promise<void> {
    return (await this.resolve()).clearCache(collection)
  }
}

/** React hook reflecting the engine's sync state. */
export function useSyncState(): SyncState {
  const e = getEngine()
  const [state, setState] = useState<SyncState>(() => e.getState())

  useEffect(() => {
    return e.subscribe(setState)
  }, [e])

  return state
}
