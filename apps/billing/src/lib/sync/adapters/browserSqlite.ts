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
 * attaches `window.initSqlJs`, which avoids ESM/CJS bundling entirely. The
 * database is in-memory, so data does not survive a page reload (acceptable
 * for the offline-queue UI flows this backend is used to verify).
 */
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
  const db = new SQL.Database()

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
