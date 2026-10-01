# ADR-0002: Offline-First Architecture with SyncEngine

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Architecture team

## Context

The billing application must work reliably in environments with intermittent connectivity (community offices, field work). Users need to create vouchers, manage members, and record transactions offline, with seamless sync when connectivity returns.

## Decision

Adopt an **offline-first architecture** with the following components:

### 1. Local Storage Adapters
- **IndexedDB** (web): Primary storage for browser-based SPA
- **SQLite** (Tauri desktop): Via `@tauri-apps/plugin-sql` for native app
- **Common Interface**: `StorageAdapter` with CRUD + KV + id mapping

### 2. Sync Engine (`apps/billing/src/lib/sync/SyncEngine.ts`)
- **Outbox Pattern**: All writes go to local outbox first
- **Optimistic UI**: Local IDs (`local-*`) resolve to server IDs on flush
- **Conflict Detection**: Server version vs local version on sync
- **Periodic Sync**: 60s push + 5min pull intervals
- **Visibility Sync**: Pull on tab focus/visibility change

### 3. Cache-First Reads
- Collections cached in IndexedDB/SQLite with tenant-scoped keys
- `cacheVersion` bumped on mutations for React re-renders
- Staleness detection for reports (2-minute threshold)

### 4. API Layer (`apps/billing/src/lib/api.ts`)
- Single entry point for all server communication
- Automatic tenant query injection
- Offline queue integration via `offlineRequest()`

### 5. Compatibility Wrapper (`apps/billing/src/lib/offline/index.ts`)
- `CompatibilityEngine` wraps new `SyncEngine` for legacy API
- `getEngine()`, `useSyncState()` for React components

## Key Invariants

1. **No direct server writes** — all mutations go through `offlineRequest()`
2. **Outbox ordering preserved** — FIFO flush ensures causal consistency
3. **Local ID resolution** — `local-*` IDs mapped to server IDs on flush
4. **Tenant isolation** — All cache keys prefixed with `tenantId:`
5. **Idempotent sync** — Safe to retry; server handles deduplication

## Consequences

**Positive:**
- Works fully offline
- Fast UI (local reads)
- Resilient to network issues

**Negative:**
- Complexity in conflict resolution
- Eventual consistency (not strong)
- Storage limits on mobile browsers

## Related

- ADR-0001: Data Model Governance (collection changes affect sync)
- ADR-0004: Import/Export (bulk ops use same offline pipeline)
- `apps/billing/src/lib/sync/` - Sync engine implementation
- `apps/billing/src/lib/offline/` - Offline types and compatibility layer
- `apps/billing/src/lib/api.ts` - API with offline integration