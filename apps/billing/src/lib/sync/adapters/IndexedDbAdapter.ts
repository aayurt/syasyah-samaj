import type { StorageAdapter, SyncOperation } from '../StorageAdapter'

/**
 * IndexedDB-backed storage adapter for the web PWA.
 * Uses the same schema as the existing offline store for backward compatibility.
 *
 * Object stores:
 *   kv      (key)          — cursors, id-maps, settings
 *   outbox  (seq, autoInc) — queued writes
 *   cache   ([collection, id]) — read-through cache
 *   idmap   (localId)      — local → server ID mapping
 */

const DB_NAME = 'afno-billing-offline'
const DB_VERSION = 2 // bumped to add idmap store

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
      if (!db.objectStoreNames.contains('idmap')) {
        db.createObjectStore('idmap', { keyPath: 'localId' })
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

type StoreName = 'kv' | 'outbox' | 'cache' | 'idmap'

export class IndexedDbAdapter implements StorageAdapter {
  private db: Promise<IDBDatabase> | null = null

  async ready(): Promise<void> {
    this.db = this.db ?? openDb()
    await this.db
  }

  private async store(
    name: StoreName,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<{ store: IDBObjectStore; done: Promise<void> }> {
    await this.ready()
    const db = await this.db!
    const tx = db.transaction(name, mode)
    return { store: tx.objectStore(name), done: txDone(tx) }
  }

  // ── Outbox ────────────────────────────────────────────────────

  async enqueue(op: SyncOperation): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    const { seq: _seq, ...rest } = op
    store.add(rest)
    await done
  }

  async getPending(): Promise<SyncOperation[]> {
    const all = await this.getAll()
    return all.filter((e) => !e.conflict).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  }

  async getAll(): Promise<SyncOperation[]> {
    const { store, done } = await this.store('outbox')
    const rows = await reqResult(store.getAll() as IDBRequest<any[]>)
    await done
    return rows.sort((a: any, b: any) => (a.seq ?? 0) - (b.seq ?? 0))
  }

  async removePending(seq: number): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    store.delete(seq)
    await done
  }

  async markConflict(seq: number, reason: string): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    const row = await reqResult(store.get(seq) as IDBRequest<any>)
    if (row) {
      store.put({
        ...row,
        conflict: { message: reason, at: new Date().toISOString() },
      })
    }
    await done
  }

  async unmarkConflict(seq: number): Promise<void> {
    const { store, done } = await this.store('outbox', 'readwrite')
    const row = await reqResult(store.get(seq) as IDBRequest<any>)
    if (row && row.conflict) {
      const { conflict: _, ...rest } = row
      store.put(rest)
    }
    await done
  }

  async pendingCount(): Promise<number> {
    const { store, done } = await this.store('outbox')
    const all = await reqResult(store.getAll() as IDBRequest<any[]>)
    await done
    return all.filter((e: any) => !e.conflict).length
  }

  async getEntry(seq: number): Promise<SyncOperation | null> {
    const { store, done } = await this.store('outbox')
    const row = await reqResult(store.get(seq) as IDBRequest<any>)
    await done
    return row ?? null
  }

  // ── Cache ─────────────────────────────────────────────────────

  async upsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    const { store, done } = await this.store('cache', 'readwrite')
    store.put({
      collection,
      id: String((doc as any).id),
      json: JSON.stringify(doc),
    })
    await done
  }

  async get(collection: string, id: number | string): Promise<Record<string, unknown> | null> {
    const { store, done } = await this.store('cache')
    const row = await reqResult(
      store.get([collection, String(id)]) as IDBRequest<{ json: string } | undefined>,
    )
    await done
    return row ? JSON.parse(row.json) : null
  }

  async list(collection: string): Promise<Record<string, unknown>[]> {
    const { store, done } = await this.store('cache')
    // Since the key path is [collection, id], records are sorted by collection
    // first. Use a cursor to scan only the matching prefix — avoids loading
    // every cached document into memory.
    const results: Record<string, unknown>[] = []
    const range = IDBKeyRange.bound(
      [collection, ''],
      [collection, '￿'],
    )
    const req = store.openCursor(range)
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) return resolve()
        const rec = cursor.value as { json: string }
        results.push(JSON.parse(rec.json))
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
    await done
    return results
  }

  async remove(collection: string, id: number | string): Promise<void> {
    const { store, done } = await this.store('cache', 'readwrite')
    store.delete([collection, String(id)])
    await done
  }

  async clearCollection(collection: string): Promise<void> {
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

  // ── Key-value ─────────────────────────────────────────────────

  async getKey(key: string): Promise<string | null> {
    const { store, done } = await this.store('kv')
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

  // ── ID mapping ────────────────────────────────────────────────

  async mapLocalToServer(localId: string, serverId: number): Promise<void> {
    const { store, done } = await this.store('idmap', 'readwrite')
    store.put({ localId, serverId })
    await done
  }

  async getServerId(localId: string): Promise<number | null> {
    const { store, done } = await this.store('idmap')
    const row = await reqResult(
      store.get(localId) as IDBRequest<{ serverId: number } | undefined>,
    )
    await done
    return row?.serverId ?? null
  }

  async getIdMap(): Promise<Record<string, number>> {
    const { store, done } = await this.store('idmap')
    const all = await reqResult(store.getAll() as IDBRequest<any[]>)
    await done
    const map: Record<string, number> = {}
    for (const row of all) {
      map[row.localId] = row.serverId
    }
    return map
  }

  async setIdMap(map: Record<string, number>): Promise<void> {
    const { store, done } = await this.store('idmap', 'readwrite')
    store.clear()
    for (const [localId, serverId] of Object.entries(map)) {
      store.put({ localId, serverId })
    }
    await done
  }
}
