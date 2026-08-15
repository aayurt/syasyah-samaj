import type { OfflineDb, OutboxEntry } from './types'

/**
 * In-memory fallback for the offline store. Used when running outside Tauri
 * (plain browser dev, tests) where there is no SQLite. The sync engine works
 * identically against it — data just doesn't survive a reload.
 */
export class MemoryDb implements OfflineDb {
  private kv = new Map<string, string>()
  private outbox = new Map<number, OutboxEntry>()
  private nextSeq = 1
  private cache = new Map<string, Record<string, unknown>>()

  async ready() {}

  async getKey(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null
  }

  async setKey(key: string, value: string): Promise<void> {
    this.kv.set(key, value)
  }

  async deleteKey(key: string): Promise<void> {
    this.kv.delete(key)
  }

  async enqueue(entry: Omit<OutboxEntry, 'seq'>): Promise<void> {
    const seq = this.nextSeq++
    this.outbox.set(seq, { ...entry, seq })
  }

  async pending(): Promise<OutboxEntry[]> {
    return [...this.outbox.values()].sort((a, b) => a.seq - b.seq)
  }

  async pendingCount(): Promise<number> {
    return this.outbox.size
  }

  async remove(seq: number): Promise<void> {
    this.outbox.delete(seq)
  }

  async markConflict(seq: number, message: string): Promise<void> {
    const entry = this.outbox.get(seq)
    if (entry) {
      this.outbox.set(seq, {
        ...entry,
        conflict: { message, at: new Date().toISOString() },
      })
    }
  }

  async unmarkConflict(seq: number): Promise<void> {
    const entry = this.outbox.get(seq)
    if (entry && entry.conflict) {
      const { conflict: _conflict, ...rest } = entry
      this.outbox.set(seq, rest)
    }
  }

  async cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    const id = String((doc as { id: unknown }).id)
    this.cache.set(`${collection}:${id}`, doc)
  }

  async cacheList(collection: string): Promise<Record<string, unknown>[]> {
    const prefix = `${collection}:`
    return [...this.cache.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v)
  }

  async cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null> {
    return this.cache.get(`${collection}:${String(id)}`) ?? null
  }

  async clearCache(collection: string): Promise<void> {
    const prefix = `${collection}:`
    for (const k of [...this.cache.keys()]) {
      if (k.startsWith(prefix)) this.cache.delete(k)
    }
  }
}
