import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SyncEngine } from '../../src/lib/sync/SyncEngine'
import type { StorageAdapter } from '../../src/lib/sync/StorageAdapter'
import { SqliteAdapter, type SqliteDriver } from '../../src/lib/sync/adapters/SqliteAdapter'

/**
 * 08 — Desktop storage backend (no browser).
 *
 * The Tauri desktop app persists its offline store in SQLite through the
 * SqliteAdapter (@tauri-apps/plugin-sql). That adapter can't run inside a
 * plain-browser Playwright page, but its only dependency is a duck-typed
 * driver (execute/select) — so this project runs the REAL SqliteAdapter +
 * REAL SyncEngine in Node against a file-backed SQLite (node:sqlite) and the
 * live e2e API: queue a write while offline, restart the engine on the same
 * database file, and watch init() flush it. The adapter's SQL is the code
 * under test here; the browser suites cover the UI over IndexedDB.
 */

const API = `http://localhost:${process.env.E2E_API_PORT || 3100}`
const WEB = `http://localhost:${process.env.E2E_WEB_PORT || 5174}`
const EMAIL = process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'SyashaAdmin2026!'

/** File-backed sqlite driver with the same execute/select surface plugin-sql exposes. */
function makeDriver(file: string): SqliteDriver & { db: DatabaseSync } {
  const db = new DatabaseSync(file)
  return {
    db,
    async execute(sql: string, params?: unknown[]) {
      if (params && params.length) db.prepare(sql).run(...params)
      else db.exec(sql)
    },
    async select<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
      const stmt = db.prepare(sql)
      return (params && params.length ? stmt.all(...params) : stmt.all()) as T[]
    },
  }
}

async function signInCookie(): Promise<string> {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: WEB },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`sign-in failed: HTTP ${res.status}`)
  const cookies = res.headers.getSetCookie?.() ?? []
  const session = cookies.find((c) => c.startsWith('better-auth.session_token='))
  if (!session) throw new Error('sign-in returned no session cookie')
  return session.split(';')[0]!
}

function fetchJson(url: string, cookie: string) {
  return fetch(url, { headers: { cookie } }).then(async (r) => {
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
    return r.json()
  })
}

async function resolveFirstId(cookie: string, slug: string, what: string): Promise<number> {
  const j = await fetchJson(`${API}/api/${slug}?limit=1&depth=0`, cookie)
  const doc = (j.docs || [])[0]
  if (!doc) throw new Error(`no seeded ${what} — run the journey (00→07) first`)
  return Number(doc.id)
}

async function resolveTenantId(cookie: string): Promise<number | undefined> {
  // The app's data lives under the tenant that owns the active fiscal year
  // (2083-84 → tenant 2). The bootstrap 'default' tenant (id 1) has no FY and
  // would fall back to a calendar-year numbering sequence — pick the tenant
  // the active fiscal year belongs to instead.
  try {
    const fys: any = await fetchJson(`${API}/api/fiscal-years?limit=20&depth=0`, cookie)
    const active = (fys.docs || []).find(
      (f: { isActive?: boolean; status?: string }) => f.isActive === true || f.status === 'active',
    )
    if (active) return Number(active.tenant ?? active.tenantId)
  } catch {
    // fall through to the tenants list
  }
  const list: any = await fetchJson(`${API}/api/tenants?limit=10&depth=0`, cookie)
  const def = (list?.docs || []).find((t: { slug?: string }) => t.slug === 'default')
  return def ? Number(def.id) : undefined
}

async function findDocByNarration(cookie: string, narration: string): Promise<any | null> {
  const url = `${API}/api/documents?limit=5&depth=0&where[narration][equals]=${encodeURIComponent(narration)}`
  const j: any = await fetchJson(url, cookie)
  return (j.docs || []).find((d: { narration?: string }) => d.narration === narration) || null
}

test.describe.serial('08 — desktop SQLite storage adapter', () => {
  test('offline save & post persists in SQLite and posts after an engine restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'syasya-sqlite-'))
    const file = join(dir, 'sync.db')
    const narration = `E2E sqlite posted ${Date.now()}`
    const cookie = await signInCookie()
    const partyId = await resolveFirstId(cookie, 'parties', 'party')
    const itemId = await resolveFirstId(cookie, 'items', 'item')
    const tenantId = await resolveTenantId(cookie)

    // Attach the session cookie to every request the engine makes.
    const realFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith(API)) {
        const headers = new Headers(init?.headers)
        if (!headers.has('cookie')) headers.set('cookie', cookie)
        init = { ...init, headers }
      }
      return realFetch(input, init)
    }) as typeof fetch

    const driverA = makeDriver(file)
    const adapterA = new SqliteAdapter(file, driverA)
    await adapterA.ready()

    // ── Session 1: app boots online, then goes offline and queues a
    //    Save & post — the create op PLUS the custom /post op that the SPA's
    //    VoucherForm.submit queues against the local-* id (offlineRequest). ──
    const engineA = new SyncEngine(adapterA, API)
    await engineA.init()
    engineA.setOnline(false) // connectivity dropped — writes must queue
    const body: Record<string, unknown> = {
      docType: 'sales-invoice',
      date: '2026-07-16',
      narration,
      status: 'draft',
      taxRate: 13,
      // Posting validates line totals — the draft must carry a real line
      // (server rejects "at least one line" like the UI does).
      lines: [{ description: 'E2E sqlite line', item: itemId, qty: 1, rate: 5000 }],
    }
    if (partyId) body.party = partyId
    if (tenantId) body.tenant = tenantId

    const queued = await engineA.offlineWrite('POST', 'documents', undefined, body)
    const localId = String(queued.id)
    expect(localId).toMatch(/^local-/)
    // Post the same doc: custom op referencing the local id (create+post).
    await engineA.queue({
      op: 'create',
      collection: 'documents',
      id: localId,
      data: { _action: 'post' },
    })
    expect(await adapterA.pendingCount()).toBe(2)

    // Both writes really live in SQLite: the create carries the local id and
    // body, the post op references it with _action=post. The optimistic cache
    // row shows the draft locally even though the server never saw it.
    const outboxRows = driverA.db.prepare('SELECT * FROM outbox ORDER BY seq').all() as any[]
    expect(outboxRows).toHaveLength(2)
    expect(String(outboxRows[0]!.local_id)).toBe(localId)
    expect(JSON.parse(String(outboxRows[0]!.data)).narration).toBe(narration)
    expect(String(outboxRows[1]!.id)).toBe(localId)
    expect((JSON.parse(String(outboxRows[1]!.data)) as { _action?: string })._action).toBe('post')
    const optimistic = await adapterA.get('documents', localId)
    expect(optimistic).toBeTruthy()
    expect(optimistic!._pendingSync).toBe(true)

    await engineA.destroy()
    driverA.db.close()

    // ── Session 2: the app restarts (new connection, same database file) ──
    // init() sees the pending ops and auto-flushes — no manual resync. The
    // flush batches the create first (mapping local→server in idmap), then
    // resolves the /post op through that map and POSTs it: the doc is posted
    // and the server assigns a fiscal-year voucher number.
    const driverB = makeDriver(file)
    const adapterB: StorageAdapter = new SqliteAdapter(file, driverB)
    await adapterB.ready()
    const engineB = new SyncEngine(adapterB, API)
    await engineB.init()

    let serverId: number | null = null
    let number = ''
    await expect
      .poll(async () => {
        const d = await findDocByNarration(cookie, narration)
        if (d && d.status === 'posted') {
          serverId = Number(d.id)
          number = String(d.number || '')
        }
        return d?.status === 'posted'
      }, { timeout: 30_000, intervals: [250, 500, 1000] })
      .toBe(true)
    expect(serverId).not.toBeNull()
    expect(number).toMatch(/^SI-2083-84-\d{4}$/)

    // Outbox drained (create + post both applied), local→server id mapped,
    // cache row carries the real id.
    expect(await adapterB.pendingCount()).toBe(0)
    const remaining = driverB.db.prepare('SELECT COUNT(*) AS c FROM outbox').get() as {
      c: number | bigint
    }
    expect(Number(remaining.c)).toBe(0)
    expect(await adapterB.getServerId(localId)).toBe(serverId)
    const cached = await adapterB.get('documents', serverId!)
    expect(cached).toBeTruthy()
    expect(String(cached!.id)).toBe(String(serverId))
    // The flush replaces the optimistic local row with the server's
    // authoritative copy — the _pendingSync marker is gone entirely.
    expect(cached!._pendingSync).not.toBe(true)

    await engineB.destroy()

    // ── Cleanup: try to remove the posted voucher server-side; posted docs
    //    may be protected from deletion, and the next full run's 00-seed
    //    wipes documents anyway — so this is best-effort. ──
    const del = await fetch(`${API}/api/documents/${serverId}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    if (!del.ok) {
      const j = await del.json().catch(() => ({}))
      console.log(`[08] posted-voucher cleanup skipped (HTTP ${del.status}: ${JSON.stringify(j).slice(0, 120)})`)
    }
    driverB.db.close()
    rmSync(dir, { recursive: true, force: true })
    globalThis.fetch = realFetch
  })
})
