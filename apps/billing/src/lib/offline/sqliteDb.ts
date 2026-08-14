import type { OfflineDb, OutboxEntry } from './types'

type SqlDatabase = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>
  select<T>(query: string, bindValues?: unknown[]): Promise<T[]>
}

/**
 * SQLite-backed offline store using tauri-plugin-sql. Only used inside the
 * Tauri desktop app; the module is imported dynamically so browsers and
 * tests never load it.
 */
export class SqliteDb implements OfflineDb {
  private db: SqlDatabase | null = null

  async ready() {
    if (this.db) return
    const mod = await import('@tauri-apps/plugin-sql')
    const Database = mod.default
    this.db = await Database.load('sqlite:afno-billing.db')
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    )
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        body TEXT,
        queued_at TEXT NOT NULL,
        local_id TEXT
      )`,
    )
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS cache (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      )`,
    )
  }

  private async getDb(): Promise<SqlDatabase> {
    await this.ready()
    return this.db!
  }

  async getKey(key: string): Promise<string | null> {
    const db = await this.getDb()
    const rows = await db.select<{ value: string }>(
      'SELECT value FROM kv WHERE key = $1',
      [key],
    )
    return rows[0]?.value ?? null
  }

  async setKey(key: string, value: string): Promise<void> {
    const db = await this.getDb()
    await db.execute(
      'INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      [key, value],
    )
  }

  async deleteKey(key: string): Promise<void> {
    const db = await this.getDb()
    await db.execute('DELETE FROM kv WHERE key = $1', [key])
  }

  async enqueue(entry: Omit<OutboxEntry, 'seq'>): Promise<void> {
    const db = await this.getDb()
    await db.execute(
      'INSERT INTO outbox (method, path, body, queued_at, local_id) VALUES ($1, $2, $3, $4, $5)',
      [
        entry.method,
        entry.path,
        JSON.stringify(entry.body),
        entry.queuedAt,
        entry.localId ?? null,
      ],
    )
  }

  async pending(): Promise<OutboxEntry[]> {
    const db = await this.getDb()
    const rows = await db.select<{
      seq: number
      method: string
      path: string
      body: string | null
      queued_at: string
      local_id: string | null
    }>(
      'SELECT seq, method, path, body, queued_at, local_id FROM outbox ORDER BY seq',
    )
    return rows.map((r) => ({
      seq: r.seq,
      method: r.method,
      path: r.path,
      body: r.body ? JSON.parse(r.body) : undefined,
      queuedAt: r.queued_at,
      localId: r.local_id ?? undefined,
    }))
  }

  async pendingCount(): Promise<number> {
    const db = await this.getDb()
    const rows = await db.select<{ c: number }>(
      'SELECT COUNT(*) AS c FROM outbox',
    )
    return Number(rows[0]?.c ?? 0)
  }

  async remove(seq: number): Promise<void> {
    const db = await this.getDb()
    await db.execute('DELETE FROM outbox WHERE seq = $1', [seq])
  }

  async cacheUpsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    const db = await this.getDb()
    const id = String((doc as { id: unknown }).id)
    await db.execute(
      `INSERT INTO cache (collection, id, json) VALUES ($1, $2, $3)
       ON CONFLICT(collection, id) DO UPDATE SET json = $3`,
      [collection, id, JSON.stringify(doc)],
    )
  }

  async cacheList(collection: string): Promise<Record<string, unknown>[]> {
    const db = await this.getDb()
    const rows = await db.select<{ json: string }>(
      'SELECT json FROM cache WHERE collection = $1',
      [collection],
    )
    return rows.map((r) => JSON.parse(r.json))
  }

  async cacheGet(collection: string, id: string | number): Promise<Record<string, unknown> | null> {
    const db = await this.getDb()
    const rows = await db.select<{ json: string }>(
      'SELECT json FROM cache WHERE collection = $1 AND id = $2',
      [collection, String(id)],
    )
    return rows[0] ? JSON.parse(rows[0].json) : null
  }

  async clearCache(collection: string): Promise<void> {
    const db = await this.getDb()
    await db.execute('DELETE FROM cache WHERE collection = $1', [collection])
  }
}
