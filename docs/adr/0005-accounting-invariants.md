---
id: "0005"
title: "Double-Entry Accounting Invariants"
status: "accepted"
date: "2026-10-01"
deciders: "Architecture team"
---

# ADR-0005: Double-Entry Accounting Invariants

## Context

The accounting module (Vouchers, Journal Entries, Daybooks, Posting) must maintain double-entry bookkeeping invariants at all times. Any violation corrupts financial reports and audit trails.

## Decision

### Core Invariants (Enforced at Multiple Levels)

1. **Debit = Credit** — Every voucher/journal entry must balance
   - Enforced in `VoucherForm` on submit
   - Enforced in API validation (`/documents` POST/PATCH)
   - Enforced in database constraint (Postgres check)

2. **No Orphaned Lines** — Every voucher line references valid Account + Party/Item
   - Foreign key constraints in Payload collections
   - UI prevents deletion of referenced accounts

3. **Fiscal Year Boundaries** — Entries only in open fiscal years
   - `appliedDate` (AD) must fall within active fiscal year
   - `appliedDateBs` (BS) validated against same year
   - Year-end close prevents further entries

4. **Opening Balance Carry-Forward** — Prior year closing = current year opening
   - Automated on fiscal year transition
   - Manual adjustment via OpeningBalances collection

5. **Posted = Immutable** — Posted vouchers cannot be edited
   - Void + new voucher for corrections
   - Audit log tracks all changes

6. **Voucher Numbering** — Sequential, gapless per DocSequence
   - DocSequences collection manages prefixes + counters
   - Reset on fiscal year change (configurable)

### Implementation Layers

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **UI** | Real-time validation, user feedback | `VoucherForm.tsx`, `Journal.tsx`, `Posting.tsx` |
| **API** | Server-side validation, constraints | `src/lib/api.ts`, Payload hooks |
| **Database** | Foreign keys, check constraints | Payload collections, migrations |
| **Sync/Offline** | Outbox validates before queue | `offlineImport.ts`, `SyncEngine` |
| **Import** | Excel import validates balances | `excelImportExport.ts`, `classifyRecords` |

### Validation Points

1. **VoucherForm** — Line-level debit/credit sums, running total
2. **Posting Queue** — Final validation before posting
3. **Sync Flush** — Re-validate on server receipt
4. **Import** — Row-level balance check before queue
5. **Reports** — Trial Balance must = 0 (sanity check)

### Error Handling

- **Client**: Toast + inline field errors + disable submit
- **Server**: 400 with detailed field errors
- **Sync**: Conflict entry in outbox, user resolves in UI
- **Import**: Row errors in preview, user fixes or skips

## Consequences

**Positive:**
- Financial data integrity guaranteed
- Audit-ready at all times
- Clear error messages guide users

**Negative:**
- More validation code to maintain
- Slightly slower voucher entry (real-time calc)
- Import requires balanced entries (no partial)

## Related

- ADR-0001: Data Model Governance (account schema changes)
- ADR-0002: Offline-First (offline validation)
- ADR-0004: Import/Export (balanced import validation)
- `apps/billing/src/pages/Vouchers.tsx` — main entry point
- `apps/billing/src/components/VoucherForm.tsx` — form with validation
- `apps/billing/src/pages/Posting.tsx` — posting queue
- `apps/billing/src/collections/Documents.ts` — voucher collection
- `apps/billing/src/collections/JournalEntries.ts` — journal collection