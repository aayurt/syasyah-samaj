import type { StorageAdapter, SyncOperation } from '../StorageAdapter'

/**
 * SQLite-backed storage adapter for the Tauri desktop app.
 * Uses @tauri-apps/plugin-sql for database access.
 *
 * Tables:
 *   outbox  (seq INTEGER PRIMARY KEY AUTOINCREMENT)
 *   cache   (collection TEXT, id TEXT, data TEXT, updated_at TEXT)
 *   kv      (key TEXT PRIMARY KEY, value TEXT)
 *   idmap   (local_id TEXT PRIMARY KEY, server_id INTEGER)
 */

// Dynamic import so this module can be tree-shaken on web builds
let Database: any = null

async function getDb() {
  if (!Database) {
    try {
      const mod = await import('@tauri-apps/plugin-sql')
      Database = mod.default || mod
    } catch {
      throw new Error(
        'SQLite adapter requires @tauri-apps/plugin-sql. ' +
          'This adapter only runs inside a Tauri desktop app.',
      )
    }
  }
  return Database
}

export class SqliteAdapter implements StorageAdapter {
  private db: any = null
  private dbPath = 'syasya-sync.db'

  constructor(dbPath?: string) {
    if (dbPath) this.dbPath = dbPath
  }

  async ready(): Promise<void> {
    if (this.db) return
    const SqliteDb = await getDb()
    this.db = await SqliteDb.load(this.dbPath)

    // Create tables if they don't exist
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        op TEXT NOT NULL,
        collection TEXT NOT NULL,
        id INTEGER,
        local_id TEXT,
        data TEXT,
        queued_at TEXT NOT NULL,
        conflict TEXT
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS cache (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT,
        PRIMARY KEY (collection, id)
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS idmap (
        local_id TEXT PRIMARY KEY,
        server_id INTEGER NOT NULL
      )
    `)
  }

  // ── Outbox ────────────────────────────────────────────────────

  async enqueue(op: SyncOperation): Promise<void> {
    await this.db.execute(
      `INSERT INTO outbox (op, collection, id, local_id, data, queued_at, conflict)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        op.op,
        op.collection,
        op.id ?? null,
        op.localId ?? null,
        JSON.stringify(op.data ?? {}),
        op.queuedAt,
        op.conflict ? JSON.stringify(op.conflict) : null,
      ],
    )
  }

  async getPending(): Promise<SyncOperation[]> {
    const rows: any[] = await this.db.select(
      `SELECT * FROM outbox WHERE conflict IS NULL ORDER BY seq ASC`,
    )
    return rows.map(this.rowToEntry)
  }

  async getAll(): Promise<SyncOperation[]> {
    const rows: any[] = await this.db.select(
      `SELECT * FROM outbox ORDER BY seq ASC`,
    )
    return rows.map(this.rowToEntry)
  }

  async removePending(seq: number): Promise<void> {
    await this.db.execute(`DELETE FROM outbox WHERE seq = ?`, [seq])
  }

  async markConflict(seq: number, reason: string): Promise<void> {
    await this.db.execute(
      `UPDATE outbox SET conflict = ? WHERE seq = ?`,
      [JSON.stringify({ message: reason, at: new Date().toISOString() }), seq],
    )
  }

  async unmarkConflict(seq: number): Promise<void> {
    await this.db.execute(`UPDATE outbox SET conflict = NULL WHERE seq = ?`, [seq])
  }

  async pendingCount(): Promise<number> {
    const rows: any[] = await this.db.select(
      `SELECT COUNT(*) as count FROM outbox WHERE conflict IS NULL`,
    )
    return rows[0]?.count ?? 0
  }

  async getEntry(seq: number): Promise<SyncOperation | null> {
    const rows: any[] = await this.db.select(
      `SELECT * FROM outbox WHERE seq = ?`,
      [seq],
    )
    return rows[0] ? this.rowToEntry(rows[0]) : null
  }

  private rowToEntry(row: any): SyncOperation {
    return {
      seq: row.seq,
      op: row.op,
      collection: row.collection,
      id: row.id,
      localId: row.local_id,
      data: JSON.parse(row.data || '{}'),
      queuedAt: row.queued_at,
      conflict: row.conflict ? JSON.parse(row.conflict) : undefined,
    }
  }

  // ── Cache ─────────────────────────────────────────────────────

  async upsert(collection: string, doc: Record<string, unknown>): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO cache (collection, id, data, updated_at)
       VALUES (?, ?, ?, ?)`,
      [
        collection,
        String((doc as any).id),
        JSON.stringify(doc),
        (doc as any).updatedAt ?? null,
      ],
    )
  }

  async get(collection: string, id: number | string): Promise<Record<string, unknown> | null> {
    const rows: any[] = await this.db.select(
      `SELECT data FROM cache WHERE collection = ? AND id = ?`,
      [collection, String(id)],
    )
    return rows[0] ? JSON.parse(rows[0].data) : null
  }

  async list(collection: string): Promise<Record<string, unknown>[]> {
    const rows: any[] = await this.db.select(
      `SELECT data FROM cache WHERE collection = ?`,
      [collection],
    )
    return rows.map((r: any) => JSON.parse(r.data))
  }

  async remove(collection: string, id: number | string): Promise<void> {
    await this.db.execute(
      `DELETE FROM cache WHERE collection = ? AND id = ?`,
      [collection, String(id)],
    )
  }

  async clearCollection(collection: string): Promise<void> {
    await this.db.execute(`DELETE FROM cache WHERE collection = ?`, [collection])
  }

  // ── Key-value ─────────────────────────────────────────────────

  async getKey(key: string): Promise<string | null> {
    const rows: any[] = await this.db.select(
      `SELECT value FROM kv WHERE key = ?`,
      [key],
    )
    return rows[0]?.value ?? null
  }

  async setKey(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)`,
      [key, value],
    )
  }

  async deleteKey(key: string): Promise<void> {
    await this.db.execute(`DELETE FROM kv WHERE key = ?`, [key])
  }

  // ── ID mapping ────────────────────────────────────────────────

  async mapLocalToServer(localId: string, serverId: number): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO idmap (local_id, server_id) VALUES (?, ?)`,
      [localId, serverId],
    )
  }

  async getServerId(localId: string): Promise<number | null> {
    const rows: any[] = await this.db.select(
      `SELECT server_id FROM idmap WHERE local_id = ?`,
      [localId],
    )
    return rows[0]?.server_id ?? null
  }

  async getIdMap(): Promise<Record<string, number>> {
    const rows: any[] = await this.db.select(`SELECT * FROM idmap`)
    const map: Record<string, number> = {}
    for (const row of rows) {
      map[row.local_id] = row.server_id
    }
    return map
  }

  async setIdMap(map: Record<string, number>): Promise<void> {
    await this.db.execute(`DELETE FROM idmap`)
    for (const [localId, serverId] of Object.entries(map)) {
      await this.db.execute(
        `INSERT INTO idmap (local_id, server_id) VALUES (?, ?)`,
        [localId, serverId],
      )
    }
  }
}
