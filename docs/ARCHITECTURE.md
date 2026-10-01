# Architecture Overview — syasyah-samaj Billing SPA

## System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        syasyah-samaj                            │
│  Multi-tenant community billing & accounting platform           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Web SPA     │    │  Tauri Desktop │   │  Payload CMS  │
│   (Vite)      │    │  (SQLite)      │    │  (Postgres)   │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │   Sync Engine   │
                    │  (IndexedDB/    │
                    │   SQLite +      │
                    │   Outbox)       │
                    └─────────────────┘
```

## Core Architectural Decisions

| ADR | Title | Scope |
|-----|-------|-------|
| 0001 | Data Model Governance | Collection schemas, migrations |
| 0002 | Offline-First Architecture | SyncEngine, adapters, cache |
| 0003 | Nepali Calendar & Numbers | BS dates, Devanagari digits |
| 0004 | Excel Import/Export & Dedup | Bulk data, conflict resolution |
| 0005 | Accounting Invariants | Double-entry, validation layers |

## Layer Structure (Enforced by mcp-rules.json)

```
ui (pages, components, hooks)
    │
    ▼ imports
lib (api, offline, sync, importExport, nepaliNumbers, validators)
    │
    ▼ imports
foundation (types, config, environment, payload.config)
```

**Rule:** Dependencies point inward only. No UI → lib reverse imports. No lib → ui imports.

## Data Flow

### Online Write Path
```
User Action → UI Component → offlineRequest() → Outbox (IndexedDB) 
    → SyncEngine.flush() → POST /api/sync → Server validates 
    → Server responds with server IDs → Local ID map updated 
    → cacheVersion++ → UI re-renders with server data
```

### Online Read Path
```
UI Component → useCachedList() → IndexedDB cache (tenant-scoped)
    → If stale/missing: background pull from /api/sync
    → cacheVersion++ → UI re-renders
```

### Offline Write Path
```
User Action → UI Component → offlineRequest() → Outbox (IndexedDB)
    → Optimistic UI update with local-* ID
    → When online: SyncEngine.flush() processes queue
```

### Conflict Resolution
```
SyncEngine detects conflict (server version ≠ local base version)
    → Conflict entry added to outbox with conflict: true
    → ConflictResolutionModal shows server vs local diff
    → User chooses: Use Server / Use Local / Merge
    → Resolved entry re-queued → flush continues
```

## Multi-Tenancy

- **Tenant = Ilaka** (geographic ward)
- All collections tenant-scoped via `tenant` field
- Cache keys: `${tenantId}:${collection}`
- API auto-injects `?tenant=${tenantId}` via `useTenantQuery()`
- SyncEngine scopes all operations by tenant

## Collections (Payload CMS)

| Collection | Purpose | Key Fields | Dedup Keys |
|------------|---------|------------|------------|
| Members | Community members | memberId, fullName, phone, bloodGroup, appliedDateBs | memberId, phone, email |
| Parties | Vendors/customers | name, phone, gstNumber, type | name+phone, gstNumber |
| Items | Products/services | code, name, unit, rate, taxType | code, name |
| Accounts | Chart of accounts | code, name, group, type, openingBalance | code, name |
| Documents | Vouchers (transactions) | voucherNumber, date, lines[], status | voucherNumber |
| JournalEntries | Manual journal entries | entryNumber, date, lines[] | entryNumber |
| OpeningBalances | Fiscal year openings | accountId, fiscalYear, debit, credit | accountId+fiscalYear |
| MembershipTypes | Fee structures | name, fee, durationMonths | name |

## Sync Protocol

**Endpoint:** `POST /api/sync`

**Request:**
```json
{
  "lastSyncAt": "2026-10-01T10:00:00.000Z",
  "operations": [
    { "op": "create", "collection": "members", "id": "local-abc123", "data": {...} },
    { "op": "update", "collection": "vouchers", "id": 42, "data": {...} },
    { "op": "delete", "collection": "parties", "id": "local-def456", "data": {} }
  ]
}
```

**Response:**
```json
{
  "serverTime": "2026-10-01T10:00:05.000Z",
  "applied": [
    { "localId": "local-abc123", "serverId": 123, "collection": "members" }
  ],
  "conflicts": [
    { "seq": 5, "serverVersion": {...}, "localVersion": {...} }
  ],
  "changes": [
    { "collection": "members", "data": {...}, "op": "update" }
  ]
}
```

## Offline Storage Schema

### IndexedDB (Web)
- **Object Stores**: One per collection (tenant-scoped names)
- **KV Store**: `sync_meta` for cursors, settings, cacheVersion
- **Outbox Store**: `outbox` with auto-increment seq, op, collection, id, data, queuedAt, conflict

### SQLite (Tauri)
- Same logical schema, tables instead of object stores
- WAL mode for concurrent access
- Migrations via `PRAGMA user_version`

## Nepali Localization

- **Dates**: `nepali-date-converter` for AD ↔ BS
- **Numbers**: `toNepaliDigits()` / `fromNepaliDigits()` utilities
- **Amount in Words**: `numberToWords()` (EN) + `numberToNepaliWords()` (NE)
- **Settings**: Per-tenant `nepaliDigits` toggle in BillingSettings

## Import/Export Pipeline

```
Excel File → parseExcel() → classifyRecords() → ImportPreviewModal
    → User resolves conflicts → executeImport() → offlineRequest() per record
    → Outbox → SyncEngine → Server
```

**Dedup Keys** (in `DEDUP_KEYS` config):
- Members: `memberId`, `phone`, `email`
- Parties: `name`, `phone`, `gstNumber`
- Items: `code`, `name`
- Accounts: `code`, `name`
- OpeningBalances: `accountId` + `fiscalYear`

## Testing Strategy

| Level | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | lib utilities, pure functions |
| Component | Vitest + RTL | React components in isolation |
| Integration | Vitest | Page flows with MSW mocks |
| E2E | Playwright | Full app against local Postgres |

**Coverage Target:** ≥ 80% on `lib/`, critical paths 100%

## Deployment

- **Web**: Vercel / Netlify (static SPA + API routes)
- **Desktop**: Tauri → DMG/MSI/APPIMAGE
- **Server**: Payload CMS on VPS (Postgres + Redis)
- **Sync**: WebSocket for real-time (future) / HTTP polling (current)

## Security

- **Auth**: better-auth with email/password + 2FA
- **Tenant Isolation**: Row-level in Payload + API middleware
- **Secrets**: Environment variables only, never committed
- **CSP**: Strict Content Security Policy headers