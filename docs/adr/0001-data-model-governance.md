---
id: "0001"
title: "Data Model Governance"
status: "accepted"
date: "2026-10-01"
deciders: "Architecture team"
---

# ADR-0001: Data Model Governance

## Context

The syasyah-samaj billing application manages multiple data collections (Members, Parties, Items, Accounts, Vouchers, Journal Entries, etc.) with complex relationships and multi-tenant isolation. Changes to collection schemas impact:
- Offline sync engine (cache keys, conflict resolution)
- Import/export system (deduplication keys, validation)
- Accounting invariants (double-entry, opening balances)
- Reporting accuracy

Without governance, schema changes can silently break invariants or create data corruption.

## Decision

All collection schema changes (`apps/billing/src/collections/**`) must:
1. Reference this ADR (ADR-0001) or a newer superseding ADR in the PR description
2. Include migration plan for existing tenant data
3. Update `mcp-rules.json` if deduplication keys change
4. Add/update tests for new fields and validation rules
5. Update import/export templates if fields are added/removed

The `mcp-rules.json` enforces this via `requireAdr` rule with `match: ["apps/billing/src/collections/**"]` and `adr: "0001"`.

## Consequences

**Positive:**
- Clear audit trail for data model decisions
- Prevents accidental breaking changes
- Forces consideration of offline/import implications

**Negative:**
- Additional process for schema changes
- Requires ADR maintenance

## Related

- ADR-0002: Offline-First Architecture
- ADR-0004: Excel Import/Export with Deduplication
- `apps/billing/src/collections/` - Payload collection definitions
- `apps/billing/src/lib/importExport.ts` - Dedup key configuration