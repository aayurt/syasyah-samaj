# Unified Offline Sync Architecture

**Status:** Draft v1 · **Date:** 2026-08-24
**Context:** syasyah-samaj billing module — Tauri desktop + Web PWA
**Goal:** Single sync protocol that works identically for both clients

---

## 1. Problem Statement

Currently the web app has an offline-first architecture (IndexedDB → outbox → individual API calls), but:

1. **Tauri desktop needs SQLite** — not IndexedDB — for proper relational queries offline
2. **Each API call is independent** — no batch sync, no conflict resolution in one round-trip
3. **The outbox flushes one entry at a time** — slow for bulk operations
4. **No server-side sync endpoint** — clients talk to individual REST endpoints

We need a **unified sync architecture** where both clients use the same protocol, and the server has a single sync endpoint.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                │
├─────────────────────────┬───────────────────────────────────────┤
│    Tauri Desktop        │            Web PWA                    │
│  ┌──────────────────┐   │   ┌────────────────────────┐         │
│  │     SQLite       │   │   │     IndexedDB          │         │
│  │  (full relational│   │   │  (cache + outbox)      │         │
│  │   offline DB)    │   │   │                        │         │
│  └────────┬─────────┘   │   └──────────┬─────────────┘         │
│           │              │              │                        │
│  ┌────────▼─────────┐   │   ┌──────────▼─────────────┐         │
│  │   Write-Ahead    │   │   │   Optimistic Write     │         │
│  │   Log (outbox)   │   │   │   + Outbox Queue       │         │
│  └────────┬─────────┘   │   └──────────┬─────────────┘         │
│           │              │              │                        │
└───────────┼──────────────┼──────────────┼───────────────────────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                 ┌─────────▼──────────┐
                 │   POST /api/sync   │   ← single unified endpoint
                 │   (batch ops +     │
                 │    pull changes)   │
                 └─────────┬──────────┘
                           │
                 ┌─────────▼──────────┐
                 │    PostgreSQL      │   ← source of truth
                 │    (Payload CMS)   │
                 └────────────────────┘
```

---

## 3. The Sync Protocol

### 3.1 Request Format

```typescript
POST /api/sync
Content-Type: application/json

{
  // Client's last sync timestamp (for pulling server changes)
  lastSyncAt: "2026-08-24T00:00:00Z",

  // Batch of operations to push to the server
  operations: [
    {
      op: "create",
      collection: "documents",
      localId: "local-abc123",
      data: {
        docType: "sales-invoice",
        date: "2026-08-24",
        party: 42,
        lines: [...]
      }
    },
    {
      op: "update",
      collection: "documents",
      id: 42,
      data: { narration: "Updated description" }
    },
    {
      op: "delete",
      collection: "documents",
      id: 43
    }
  ]
}
```

### 3.2 Response Format

```typescript
{
  serverTime: "2026-08-24T01:00:00Z",

  // Results of each pushed operation (in order)
  applied: [
    { localId: "local-abc123", serverId: 100, status: "created" },
    { id: 42, status: "updated" },
    { id: 43, status: "deleted" }
  ],

  // Conflicts detected (server version was newer)
  conflicts: [
    {
      index: 1,
      serverVersion: { /* current server doc */ },
      clientVersion: { /* what client tried to write */ },
      reason: "Document was modified by another user"
    }
  ],

  // Server changes since client's lastSyncAt
  changes: [
    { op: "create", collection: "documents", data: { id: 200, ... } },
    { op: "update", collection: "documents", data: { id: 150, ... } }
  ]
}
```

### 3.3 Sync Flow

```
Client                              Server
  │                                   │
  │  POST /api/sync                   │
  │  { lastSyncAt, operations[] }     │
  │ ─────────────────────────────────►│
  │                                   │
  │  1. Process operations in txn:    │
  │     create → insert, return ID    │
  │     update → check updatedAt      │
  │     delete → soft delete          │
  │                                   │
  │  2. Collect conflicts             │
  │                                   │
  │  3. Query changes since           │
  │     lastSyncAt                    │
  │                                   │
  │  { applied[], conflicts[],        │
  │    changes[], serverTime }        │
  │ ◄─────────────────────────────────│
  │                                   │
  │  4. Apply server changes to       │
  │     local DB                      │
  │                                   │
  │  5. Update local lastSyncAt       │
```

---

## 4. Server Implementation

### 4.1 Endpoint: POST /api/sync

```typescript
// src/app/(payload)/api/sync/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

interface SyncOperation {
  op: 'create' | 'update' | 'delete'
  collection: string
  id?: number | string
  localId?: string
  data?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const body = await req.json()

  const results = {
    serverTime: new Date().toISOString(),
    applied: [] as any[],
    conflicts: [] as any[],
    changes: [] as any[],
  }

  // Auth check
  if (!req.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate batch size
  if (body.operations?.length > 100) {
    return NextResponse.json(
      { error: 'Max 100 operations per request' },
      { status: 400 }
    )
  }

  // Process operations in a single transaction
  if (body.operations?.length) {
    const txnId = await payload.db.beginTransaction()

    try {
      for (let i = 0; i < body.operations.length; i++) {
        const op = body.operations[i]
        try {
          const result = await processOperation(payload, op)
          results.applied.push({ index: i, ...result })
        } catch (err) {
          results.conflicts.push({
            index: i,
            reason: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      await payload.db.commitTransaction(txnId)
    } catch {
      await payload.db.rollbackTransaction(txnId)
      results.conflicts = body.operations.map((_: any, i: number) => ({
        index: i,
        reason: 'Transaction failed',
      }))
      results.applied = []
    }
  }

  // Pull changes since lastSyncAt
  if (body.lastSyncAt) {
    const collections = [
      'documents', 'journal-entries', 'parties',
      'items', 'gl-accounts', 'account-groups',
    ]

    for (const slug of collections) {
      const res = await payload.find({
        collection: slug as any,
        where: { updatedAt: { greater_than: body.lastSyncAt } },
        limit: 1000,
        depth: 0,
      })

      for (const doc of res.docs) {
        results.changes.push({
          op: 'update',
          collection: slug,
          data: doc,
        })
      }
    }
  }

  return NextResponse.json(results)
}

async function processOperation(payload: any, op: SyncOperation) {
  switch (op.op) {
    case 'create': {
      const doc = await payload.create({
        collection: op.collection,
        data: op.data,
        overrideAccess: true,
      })
      return { status: 'created', serverId: doc.id }
    }

    case 'update': {
      const existing = await payload.findByID({
        collection: op.collection,
        id: op.id,
        depth: 0,
        overrideAccess: true,
      })

      if (existing?.updatedAt && op.data?.updatedAt) {
        if (new Date(existing.updatedAt) > new Date(op.data.updatedAt)) {
          throw new Error('Conflict: server version is newer')
        }
      }

      await payload.update({
        collection: op.collection,
        id: op.id,
        data: op.data,
        overrideAccess: true,
      })
      return { status: 'updated' }
    }

    case 'delete': {
      await payload.delete({
        collection: op.collection,
        id: op.id,
        overrideAccess: true,
      })
      return { status: 'deleted' }
    }

    default:
      throw new Error(`Unknown operation: ${op.op}`)
  }
}
```

---

## 5. Client Implementation

### 5.1 Shared Sync Engine

```typescript
// apps/billing/src/lib/sync/SyncEngine.ts

import type { StorageAdapter } from './StorageAdapter'

export interface SyncOperation {
  op: 'create' | 'update' | 'delete'
  collection: string
  id?: number | string
  localId?: string
  data?: Record<string, unknown>
  queuedAt: string
}

export interface SyncResult {
  serverTime: string
  applied: { localId?: string; serverId?: number; status: string }[]
  conflicts: { index: number; reason: string }[]
  changes: { op: string; collection: string; data: any }[]
}

export class SyncEngine {
  private online = true
  private lastSyncAt: string | null = null

  constructor(
    private storage: StorageAdapter,
    private apiBase: string,
  ) {}

  async queue(op: Omit<SyncOperation, 'queuedAt'>): Promise<void> {
    await this.storage.enqueue({
      ...op,
      queuedAt: new Date().toISOString(),
    })
  }

  async flush(): Promise<SyncResult> {
    const pending = await this.storage.getPending()
    if (pending.length === 0) {
      return {
        serverTime: new Date().toISOString(),
        applied: [],
        conflicts: [],
        changes: [],
      }
    }

    const body = {
      lastSyncAt: this.lastSyncAt,
      operations: pending.map(p => ({
        op: p.op,
        collection: p.collection,
        id: p.id,
        localId: p.localId,
        data: p.data,
      })),
    }

    const res = await fetch(`${this.apiBase}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    const result: SyncResult = await res.json()

    // Handle applied operations
    for (const applied of result.applied) {
      if (applied.localId && applied.serverId) {
        await this.storage.mapLocalToServer(
          applied.localId,
          applied.serverId
        )
      }
      const idx = result.applied.indexOf(applied)
      if (pending[idx]) {
        await this.storage.removePending(pending[idx].seq)
      }
    }

    // Handle conflicts
    for (const conflict of result.conflicts) {
      if (pending[conflict.index]) {
        await this.storage.markConflict(
          pending[conflict.index].seq,
          conflict.reason
        )
      }
    }

    // Apply server changes
    for (const change of result.changes) {
      await this.storage.upsert(change.collection, change.data)
    }

    this.lastSyncAt = result.serverTime
    await this.storage.setKey('lastSyncAt', result.serverTime)

    return result
  }

  async syncAll(): Promise<void> {
    await this.flush()
  }
}
```

### 5.2 Storage Adapter Interface

```typescript
// apps/billing/src/lib/sync/StorageAdapter.ts

import type { SyncOperation } from './SyncEngine'

export interface StorageAdapter {
  // Queue
  enqueue(op: SyncOperation): Promise<void>
  getPending(): Promise<SyncOperation[]>
  removePending(seq: number): Promise<void>
  markConflict(seq: number, reason: string): Promise<void>

  // Cache
  upsert(collection: string, doc: Record<string, unknown>): Promise<void>
  get(collection: string, id: number | string): Promise<Record<string, unknown> | null>
  list(collection: string): Promise<Record<string, unknown>[]>
  delete(collection: string, id: number | string): Promise<void>

  // KV
  getKey(key: string): Promise<string | null>
  setKey(key: string, value: string): Promise<void>

  // ID mapping
  mapLocalToServer(localId: string, serverId: number): Promise<void>
  getServerId(localId: string): Promise<number | null>
}
```

### 5.3 Web Adapter (IndexedDB)

```typescript
// apps/billing/src/lib/sync/adapters/IndexedDbAdapter.ts

import { openDB, type IDBPDatabase } from 'idb'
import type { StorageAdapter } from '../StorageAdapter'
import type { SyncOperation } from '../SyncEngine'

export class IndexedDbAdapter implements StorageAdapter {
  private db: IDBPDatabase | null = null

  async ready() {
    this.db = await openDB('syasya-sync', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', {
            keyPath: 'seq',
            autoIncrement: true,
          })
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache')
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv')
        }
        if (!db.objectStoreNames.contains('idmap')) {
          db.createObjectStore('idmap')
        }
      },
    })
  }

  async enqueue(op: SyncOperation) {
    await this.db!.add('outbox', op)
  }

  async getPending(): Promise<SyncOperation[]> {
    return this.db!.getAll('outbox')
  }

  async removePending(seq: number) {
    await this.db!.delete('outbox', seq)
  }

  async upsert(collection: string, doc: Record<string, unknown>) {
    await this.db!.put('cache', doc, `${collection}:${doc.id}`)
  }

  async get(collection: string, id: number | string) {
    return this.db!.get('cache', `${collection}:${id}`)
  }

  async list(collection: string) {
    const all = await this.db!.getAll('cache')
    return all.filter((doc: any) => {
      const key = this.db!.getKey('cache', doc)
      return key?.startsWith(`${collection}:`)
    })
  }

  async mapLocalToServer(localId: string, serverId: number) {
    await this.db!.put('idmap', serverId, localId)
  }

  async getServerId(localId: string): Promise<number | null> {
    return this.db!.get('idmap', localId) ?? null
  }

  // ... other KV methods
}
```

### 5.4 Tauri Adapter (SQLite)

```typescript
// apps/billing/src/lib/sync/adapters/SqliteAdapter.ts

import Database from '@tauri-apps/plugin-sql'
import type { StorageAdapter } from '../StorageAdapter'
import type { SyncOperation } from '../SyncEngine'

export class SqliteAdapter implements StorageAdapter {
  private db: Database | null = null

  async ready() {
    this.db = await Database.load('syasya-sync.db')

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

  async enqueue(op: SyncOperation) {
    await this.db!.execute(
      `INSERT INTO outbox (op, collection, id, local_id, data, queued_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [op.op, op.collection, op.id ?? null, op.localId ?? null,
       JSON.stringify(op.data), op.queuedAt]
    )
  }

  async getPending(): Promise<SyncOperation[]> {
    const rows = await this.db!.select<any[]>(
      `SELECT * FROM outbox ORDER BY seq ASC`
    )
    return rows.map(row => ({
      seq: row.seq,
      op: row.op,
      collection: row.collection,
      id: row.id,
      localId: row.local_id,
      data: JSON.parse(row.data || '{}'),
      queuedAt: row.queued_at,
    }))
  }

  async upsert(collection: string, doc: Record<string, unknown>) {
    await this.db!.execute(
      `INSERT OR REPLACE INTO cache (collection, id, data, updated_at)
       VALUES (?, ?, ?, ?)`,
      [collection, String(doc.id), JSON.stringify(doc), doc.updatedAt as string]
    )
  }

  // ... other methods
}
```

---

## 6. Migration Path

| Phase | Scope | Duration |
|-------|-------|----------|
| **Phase 1** | Server `POST /api/sync` endpoint | Week 1 |
| **Phase 2** | Client `SyncEngine` + `StorageAdapter` refactor | Week 2 |
| **Phase 3** | Tauri `SqliteAdapter` | Week 3 |
| **Phase 4** | Testing & optimization | Week 4 |

---

## 7. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sync protocol** | Single `POST /api/sync` | One round-trip for all operations |
| **Conflict strategy** | Last-write-wins + conflict flag | Simple, predictable |
| **Change tracking** | `updatedAt` cursor | Already in Payload |
| **ID mapping** | Local ID → Server ID | Offline creates get temp IDs |
| **Storage** | SQLite (Tauri) / IndexedDB (Web) | Best tool per platform |
| **Batch size** | Max 100 operations | Prevents huge payloads |

---

## 8. Testing Checklist

- [ ] Create document offline → sync → appears on server
- [ ] Update document offline → sync → server reflects changes
- [ ] Delete document offline → sync → server deletes
- [ ] Conflict: two clients edit same doc → conflict flagged
- [ ] Large batch: 50 operations → sync completes in <5s
- [ ] Offline for 1 hour → come online → all changes sync
- [ ] Server changes → client pulls → local cache updated
- [ ] Tauri SQLite → same flows as Web IndexedDB
- [ ] Auth expiry during sync → proper error handling
- [ ] Network timeout → retry logic works

---

*This document supersedes the outbox-only approach in the current syncEngine.ts. The new protocol is backward-compatible: clients can still use individual API endpoints, but the sync endpoint is preferred for batch operations.*
