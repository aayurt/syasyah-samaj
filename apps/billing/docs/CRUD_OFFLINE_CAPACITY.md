# CRUD Operations & Offline Capacity — Billing App

> Every mutation (POST/PATCH/DELETE) across the billing SPA, its offline behavior, and current status.
> Last updated: September 2026.

---

## How Offline-First Works

```
User clicks Save
       │
       ▼
   api() function
       │
       ├── immediate: false (default)
       │       │
       │       ▼
       │   engine.offlineRequest()  ──→  outbox (IndexedDB/SQLite)
       │       │                              │
       │       ▼                         on reconnect
       │   Return queued result             │
       │   + optimistic cache write         ▼
       │                           SyncEngine.flush()
       │                              │           │
       │                         CRUD batch   Custom ops
       │                         POST /sync   POST /:id/action
       │                              │           │
       │                              ▼           ▼
       │                         applied[]    success/fail
       │                              │
       │                              ▼
       │                         cache update
       │                         idmap (local→server)
       │
       └── immediate: true
               │
               ▼
           doFetch()  ──→  server directly
               │
               ├── success → warm cache
               └── network error → throw (no outbox fallback)
```

**Offline-first = no `immediate: true`**. The write goes to the outbox first, then syncs in the background.

---

## Documents (Vouchers)

**Collection:** `documents` | **Sync:** ✅ Push + Pull | **Custom endpoints:** post, void, reopen, copy-to-invoice

### Create (Draft)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `POST /documents` | Outbox | ✅ Yes | ✅ Outbox flush | Queues with `_pendingSync` badge. Pre-supplied totals in body. |
| **VoucherForm.tsx** | `POST /documents` | Outbox | ✅ Yes | ✅ Outbox flush | Same as above. Returns `{ doc: { id: localId } }` |

### Edit (Draft)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `PATCH /documents/:id` | Outbox | ✅ Yes | ✅ Outbox flush | Updates optimistic cache with merged body |
| **VoucherForm.tsx** | `PATCH /documents/:id` | Outbox | ✅ Yes | ✅ Outbox flush | Same |

### Post (Draft → Posted)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `POST /documents/:id/post` | Outbox | ✅ Yes | ✅ Custom op | State transition. Sync engine sends as individual fetch after CRUD batch. |
| **VoucherForm.tsx** | `POST /documents/:id/post` | Outbox | ✅ Yes | ✅ Custom op | Same |

### Void (Posted → Voided)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `POST /documents/:id/void` | Outbox | ✅ Yes | ✅ Custom op | Full void with reason. |
| **Vouchers.tsx** | `POST /documents/:id/partial-void` | Outbox | ✅ Yes | ✅ Custom op | Partial void with item-level details. |

### Reopen (Voided → Draft)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `POST /documents/:id/reopen` | Outbox | ✅ Yes | ✅ Custom op | Returns to draft status. |

### Copy to Invoice (Quote → Invoice)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `POST /documents/:id/copy-to-invoice` | **Immediate** | ❌ No — server | ❌ No | Needs server-generated invoice ID to navigate. Legitimately server-first. |

### Delete (Draft only)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Vouchers.tsx** | `DELETE /documents/:id` | Outbox | ✅ Yes | ✅ Outbox flush | Invalidates cache. |

---

## Journal Entries

**Collection:** `journal-entries` | **Sync:** ✅ Push + Pull

### Create

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Journal.tsx** | `POST /journal-entries` | Outbox | ✅ Yes | ✅ Outbox flush | Manual journal entry. |

### Void

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Journal.tsx** | `PATCH /journal-entries/:id` | Outbox | ✅ Yes | ✅ Outbox flush | Sets `status: 'void'`. |

### Transfers

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Transfers.tsx** | `POST /journal-entries/transfers` | **Immediate** | ❌ No — server | ❌ No | Atomic cross-tenant transaction. Creates 2+ journal legs. Cannot queue offline. |
| **Transfers.tsx** | `POST /journal-entries/transfers/:ref/void` | Outbox | ✅ Yes | ✅ Custom op | Reverses both legs of a transfer. |

---

## Members

**Collection:** `members` | **Sync:** ⚠️ Push only (no pull)

### Create

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Members.tsx** | `POST /members` | Outbox | ✅ Yes | ✅ Outbox flush | Queued. Other users won't see until page refresh (no pull). |

### Edit

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Members.tsx** | `PATCH /members/:id` | Outbox | ✅ Yes | ✅ Outbox flush | Same. |

### Pay Fee

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Members.tsx** | `POST /members/:id/pay-fee` | Outbox | ✅ Yes | ✅ Custom op | Generates receipt. Server returns receiptNumber + renewalDate. |

---

## Parties

**Collection:** `parties` | **Sync:** ✅ Push + Pull

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Parties.tsx** | `POST /parties` | Outbox | ✅ Yes | ✅ Outbox flush | Inline create from VoucherForm also queues. |
| **VoucherForm.tsx** | `POST /parties` | Outbox | ✅ Yes | ✅ Outbox flush | Quick-add from voucher form. |
| **Parties.tsx** | `DELETE /parties/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |

---

## Items

**Collection:** `items` | **Sync:** ✅ Push + Pull

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Items.tsx** | `POST /items` | Outbox | ✅ Yes | ✅ Outbox flush | — |
| **VoucherForm.tsx** | `POST /items` | Outbox | ✅ Yes | ✅ Outbox flush | Quick-add from voucher form. |
| **Items.tsx** | `DELETE /items/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |

---

## GL Accounts

**Collection:** `gl-accounts` | **Sync:** ✅ Push + Pull

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Settings.tsx** | `POST /gl-accounts` | Outbox | ✅ Yes | ✅ Outbox flush | Create from Chart of Accounts section. |
| **Settings.tsx** | `DELETE /gl-accounts/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |
| **Accounts.tsx** | `POST /gl-accounts` | Outbox | ✅ Yes | ✅ Outbox flush | Create from Accounts page. |
| **Accounts.tsx** | `DELETE /gl-accounts/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |

---

## Membership Types

**Collection:** `membership-types` | **Sync:** ⚠️ Push only (no pull)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **MembershipTypes.tsx** | `POST /membership-types` | Outbox | ✅ Yes | ✅ Outbox flush | — |
| **MembershipTypes.tsx** | `PATCH /membership-types/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |
| **MembershipTypes.tsx** | `DELETE /membership-types/:id` | Outbox | ✅ Yes | ✅ Outbox flush | — |

---

## Recurring Schedules

**Collection:** `recurring-schedules` | **Sync:** ❌ Not in sync allowlist

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **RecurringBilling.tsx** | `POST /recurring-schedules` | Outbox | ⚠️ Queued but not flushed | ❌ Not in ALLOWED_COLLECTIONS | Outbox stores it, but sync endpoint rejects it. **Offline creates are lost.** |
| **RecurringBilling.tsx** | `PATCH /recurring-schedules/:id` | Outbox | ⚠️ Same | ❌ Same | — |
| **RecurringBilling.tsx** | `DELETE /recurring-schedules/:id` | Outbox | ⚠️ Same | ❌ Same | — |

> ⚠️ **Needs fix:** Add `recurring-schedules` to `ALLOWED_COLLECTIONS` and `changeCollections` in `src/app/api/sync/route.ts`.

---

## Expense Claims

**Collection:** `expense-claims` | **Sync:** ❌ Not in sync allowlist

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **ExpenseClaims.tsx** | `POST /expense-claims` | Outbox | ⚠️ Queued but not flushed | ❌ Not in ALLOWED_COLLECTIONS | **Offline creates are lost.** |
| **ExpenseClaims.tsx** | `POST /expense-claims/:id/submit` | Outbox | ⚠️ Same | ❌ Same | — |
| **ExpenseClaims.tsx** | `POST /expense-claims/:id/approve` | Outbox | ⚠️ Same | ❌ Same | Posts journal entry server-side. |
| **ExpenseClaims.tsx** | `POST /expense-claims/:id/reject` | Outbox | ⚠️ Same | ❌ Same | — |
| **ExpenseClaims.tsx** | `DELETE /expense-claims/:id` | Outbox | ⚠️ Same | ❌ Same | — |

> ⚠️ **Needs fix:** Add `expense-claims` to `ALLOWED_COLLECTIONS` and `changeCollections`. Note: approve/reject have server-side journal posting — may need `immediate: true` for those.

---

## Doc Sequences

**Collection:** `doc-sequences` | **Sync:** ❌ Not in sync allowlist

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Settings.tsx** | `PATCH /doc-sequences/:id` | Outbox | ⚠️ Queued but not flushed | ❌ Not in ALLOWED_COLLECTIONS | Number sequence reset. Server-managed. |

> Server-managed — number generation must stay authoritative on server. This is fine as server-only.

---

## Billing Settings (Global)

**Global:** `billing-settings` | **Sync:** ❌ Client cache only (localStorage)

| Page | Endpoint | Method | Saves Locally First | Background Sync | Notes |
|------|----------|--------|-------------------|-----------------|-------|
| **Settings.tsx** | `POST /globals/billing-settings` | Direct POST | ✅ localStorage | ❌ No pull | Written directly to server + localStorage. No outbox. Other users' changes require refresh. |

---

## Reads — Cache vs Server

| Page | Collection | Read Pattern | Offline Behavior |
|------|-----------|-------------|-----------------|
| **Vouchers.tsx** | documents | `useCachedList` → cache-first | ✅ Shows cached data instantly |
| **VoucherForm.tsx** | parties, gl-accounts, items, tax-types | `useCachedList` | ✅ Cache-first |
| **Members.tsx** | members | `api()` GET | ✅ Cache-first (via `api()`) |
| **Parties.tsx** | parties | `api()` GET | ✅ Cache-first |
| **Items.tsx** | items | `api()` GET | ✅ Cache-first |
| **Accounts.tsx** | gl-accounts | `api()` GET | ✅ Cache-first |
| **Journal.tsx** | journal-entries | `api()` GET | ✅ Cache-first |
| **Settings.tsx** | gl-accounts, account-groups | `api()` GET | ✅ Cache-first |
| **Dashboard.tsx** | journal-entries, documents | `api()` GET (computed) | ❌ Server-only (trial-balance, aging, P&L) |
| **Reports** | journal-entries | `api()` GET (computed) | ❌ Server-only (all reports) |
| **Daybooks.tsx** | journal-entries | `api()` GET (daybook) | ❌ Server-only |
| **BankReconciliation** | bank-statements | `api()` GET | ❌ Server-only (not in sync) |
| **ExpenseClaims.tsx** | expense-claims | `api()` GET | ❌ Server-only (not in sync) |
| **RecurringBilling** | recurring-schedules | `api()` GET | ❌ Server-only (not in sync) |
| **Calendar** | billing-settings (global) | `api()` GET globals | ✅ localStorage cache |
| **App** | billing-settings (global) | `api()` GET globals | ✅ localStorage cache |

---

## Summary — Offline Capacity

### ✅ Full Offline Support (Read + Write)

These collections save locally first and sync in the background. All CRUD operations work offline.

| Collection | Create | Edit | Delete | Custom Actions |
|-----------|--------|------|--------|---------------|
| `documents` | ✅ | ✅ | ✅ | post, void, reopen |
| `journal-entries` | ✅ | ✅ | — | void |
| `parties` | ✅ | — | ✅ | — |
| `items` | ✅ | — | ✅ | — |
| `gl-accounts` | ✅ | — | ✅ | — |
| `account-groups` | (managed server) | — | — | — |
| `tax-types` | (managed server) | — | — | — |
| `stock-movements` | (generated) | — | — | — |

### ⚠️ Partial Offline Support

| Collection | Create | Edit | Delete | Gap |
|-----------|--------|------|--------|-----|
| `members` | ✅ | ✅ | — | No pull — other users' changes not seen |
| `membership-types` | ✅ | ✅ | ✅ | No pull |
| `tenants` | — | — | — | Read-only, fetched once on login |

### ❌ No Offline Support

| Collection | Issue | Fix Needed |
|-----------|-------|-----------|
| `recurring-schedules` | Queued to outbox but not in ALLOWED_COLLECTIONS — sync rejects it | Add to sync route |
| `expense-claims` | Same — queued but rejected. approve/reject need server-side journal posting | Add to sync route + keep approve/reject as `immediate: true` |
| `bank-statements` | Not used for writes in billing app | N/A (read-only import) |
| `fixed-assets` | Not yet in UI | N/A |
| `inventory-items` | Not yet in UI | N/A |
| `doc-sequences` | Server-managed auto-increment | Keep server-only |

### Server-Only (Computed)

These are aggregate/computed endpoints — no collection to sync:

| Endpoint | Used By |
|----------|---------|
| `GET /journal-entries/trial-balance` | Dashboard, TrialBalance |
| `GET /journal-entries/profit-loss` | Dashboard, Reports |
| `GET /journal-entries/balance-sheet` | Reports |
| `GET /journal-entries/daybook` | Daybooks |
| `GET /documents/aging` | Dashboard, Aging |
| `GET /items/stock-levels` | Items, StockReports |
| `POST /documents/:id/copy-to-invoice` | Vouchers (quote → invoice) |
| `POST /journal-entries/transfers` | Transfers (atomic cross-tenant) |

---

## Remaining `immediate: true` (Server-First)

These operations legitimately require the server and cannot be queued offline:

| Operation | Page | Why Server-First |
|-----------|------|-----------------|
| `POST /documents/:id/copy-to-invoice` | Vouchers.tsx | Needs server-generated invoice ID for navigation |
| `POST /journal-entries/transfers` | Transfers.tsx | Atomic cross-tenant transaction (2+ journal legs) |
| `GET /journal-entries` (with `immediate`) | Transfers.tsx | Read bypass to get filtered list (not a write) |

---

## Recommended Fixes

### Priority 1 — Add Missing Collections to Sync

```typescript
// src/app/api/sync/route.ts

const ALLOWED_COLLECTIONS = new Set([
  // ... existing
  'recurring-schedules',
  'expense-claims',
])

const changeCollections = [
  // ... existing
  'recurring-schedules',
  'expense-claims',
  'members',          // currently push-only
  'membership-types',  // currently push-only
]
```

### Priority 2 — Keep Expense Claim Approve/Reject as Server-First

```typescript
// ExpenseClaims.tsx
// approve/reject post journal entries on server — must be immediate
await api(`/expense-claims/${id}/approve`, {
  method: 'POST',
  body,
  immediate: true,  // server-side journal posting
})
```

### Priority 3 — Real-time Sync for Members

Currently `members` has no pull — other users' changes aren't seen. Options:
1. Add to `changeCollections` (pull on reconnect)
2. Add Server-Sent Events / WebSocket for real-time push
3. Periodic background refresh (simplest)
