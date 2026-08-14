import type { OfflineDb, OutboxEntry } from './types'

/**
 * IndexedDB-backed offline store for the browser. Same interface as the
 * SQLite store used inside Tauri, so the sync engine is agnostic — but data
 * survives page reloads, which the in-memory fallback cannot do.
 *
 * Object stores:
 *   kv      (key)          — cursors, id-maps, misc settings
 *   outbox  (seq, autoInc) — queued writes, replayed in order on flush
 *   cache   ([collection, id]) — read-through cache of fetched documents
 */
const DB_NAME = 'afno-billing-offline'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: ['collection', 'id'] })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('indexedDB open blocked'))
  })
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export class IndexedDb implements OfflineDb {
  private db: Promise<IDBDatabase> | null = null

  ready(): Promise<void> {
    this.db = this.db ?? openDb()
    return this.db.then(() => undefined)
  }

  private async store(
    name: 'kv' | 'outbox' | 'cache',
    mode: IDBTransactionMode = 'readonly',
  ): Promise<{ store: IDBObjectStore; done: Promise<void> }> {
    await this.ready()
    const db = await this.db!
    const tx = db.transaction(name, mode)
    return { store: tx.objectStore(name), done: txDone(tx) }
  }

  async getKey(key: string): Promise<string | null> {
    const { store, done } = await this.store('kv')
    // The kv store's records are { key, value }; return just the value string.
    const row = await reqResult(
      store.get(key) as IDBRequest<{ key: string; value: string } | undefined>,
    )
    await done
    return row?.value ?? null
  }

  async setKey(key: string, value: string): Promise<void> {
    const { store, done } = await this.store('kv', 'readwrite')
    store.put({ key, value })
    await done
  }

  async deleteKey(key: string): Promise<void> {
    const { store, done } = await this.store('kv', 'readwrite')
    store.delete(key)
    await done
  }

  async enqueue(entry: Omit<OutboxEntry, 'seq'>): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    store.add(entry as OutboxEntry)
    await done
  }

  async pending(): Promise<OutboxEntry[]> {
    const { store, done } = await this.store('outbox')
    // getAll on a keyPath 'seq' store returns rows ordered by key ascending.
    const rows = await reqResult(store.getAll() as IDBRequest<OutboxEntry[]>)
    await done
    return rows.sort((a, b) => a.seq - b.seq)
  }

  async pendingCount(): Promise<number> {
    const { store, done } = await this.store('outbox')
    const count = await reqResult(store.count() as IDBRequest<number>)
    await done
    return count
  }

  async remove(seq: number): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    store.delete(seq)
    await done
  }

  async cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    const { store, done } = await this.store('cache', 'readwrite')
    store.put({ collection, id: String((doc as { id: unknown }).id), json: JSON.stringify(doc) })
    await done
  }

  async cacheList(collection: string): Promise<Record<string, unknown>[]> {
    const { store, done } = await this.store('cache')
    const rows = await reqResult(
      store.getAll() as IDBRequest<{ collection: string; json: string }[]>,
    )
    await done
    return rows
      .filter((r) => r.collection === collection)
      .map((r) => JSON.parse(r.json))
  }

  async cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null> {
    const { store, done } = await this.store('cache')
    const row = await reqResult(
      store.get([collection, String(id)]) as IDBRequest<{ json: string } | undefined>,
    )
    await done
    return row ? JSON.parse(row.json) : null
  }

  async clearCache(collection: string): Promise<void> {
    const { store, done } = await this.store('cache', 'readwrite')
    const req = store.openCursor()
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return resolve()
        const rec = cursor.value as { collection: string }
        if (rec.collection === collection) cursor.delete()
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
    await done
  }
}
