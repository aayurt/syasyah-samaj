import type { SqliteDriver } from './SqliteAdapter'

/**
 * Browser SQLite driver for the SqliteAdapter, backed by sql.js (SQLite
 * compiled to WebAssembly). Used only by the e2e override that forces
 * window.__SYNC_STORAGE__ = 'sqlite' in a plain browser — the Tauri desktop
 * uses @tauri-apps/plugin-sql instead, and this module is never imported on
 * the normal web path.
 *
 * sql.js ships a UMD build (dist/sql-wasm.js) plus its .wasm; the e2e init
 * script supplies the absolute URL of the UMD file (served by the Vite dev
 * server via /@fs) and this loader injects it as a classic <script> — UMD
 * attaches `window.initSqlJs`, which avoids ESM/CJS bundling entirely.
 *
 * The database lives in WASM memory, so by default it resets on a page
 * reload. For the cold-start flows this backend is used to verify, every
 * write exports the whole database (db.export()) to localStorage as base64
 * and a fresh boot re-imports it — queued outbox writes and the cache
 * survive reloads, mirroring what the Tauri plugin's file-backed SQLite
 * gives the desktop app.
 */

const STORAGE_KEY = 'syasya.sqljs.db'

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function loadPersistedDb(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? base64ToBytes(raw) : null
  } catch {
    return null
  }
}

function persistDb(db: any): void {
  try {
    localStorage.setItem(STORAGE_KEY, bytesToBase64(db.export()))
  } catch {
    // quota / storage unavailable — the session stays in-memory only
  }
}

export async function createSqlJsDriver(scriptUrl: string): Promise<SqliteDriver> {
  const win = window as Window & {
    initSqlJs?: (config?: { locateFile?: (file: string) => string }) => Promise<any>
  }
  if (!win.initSqlJs) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = scriptUrl
      s.onload = () => resolve()
      s.onerror = () =>
        reject(new Error(`browserSqlite: failed to load sql.js from ${scriptUrl}`))
      document.head.appendChild(s)
    })
    if (!win.initSqlJs) throw new Error('browserSqlite: sql.js loaded but initSqlJs is missing')
  }

  // The wasm file sits next to the loader script (dist/sql-wasm.wasm).
  const wasmUrl = scriptUrl.replace(/[^/]+$/, 'sql-wasm.wasm')
  const SQL = await win.initSqlJs({ locateFile: () => wasmUrl })
  const persisted = loadPersistedDb()
  const db = persisted ? new SQL.Database(persisted) : new SQL.Database()

  const prepareSelect = (sql: string, params?: unknown[]) => {
    const stmt = db.prepare(sql)
    if (params && params.length) stmt.bind(params as never[])
    return stmt
  }

  return {
    async execute(sql: string, params?: unknown[]) {
      if (params && params.length) {
        const stmt = db.prepare(sql)
        try {
          stmt.run(params as never[])
        } finally {
          stmt.free()
        }
      } else {
        // Raw multi-statement SQL (table DDL in ready()).
        db.exec(sql)
      }
      // Writes changed the database — persist it for the next cold boot.
      persistDb(db)
    },
    async select<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const stmt = prepareSelect(sql, params)
      try {
        const rows: T[] = []
        while (stmt.step()) rows.push(stmt.getAsObject() as T)
        return rows
      } finally {
        stmt.free()
      }
    },
  }
}
