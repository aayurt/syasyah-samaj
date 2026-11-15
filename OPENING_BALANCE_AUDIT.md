# Opening Balance Reconciliation Audit — syasyah-samaj

Scope: opening-balances collection, gl-accounts.openingBalance field, fiscal-year close carry-forward,
account balances endpoint, journal posting engine. Read-only audit — no code changed.

Files read:
- src/collections/OpeningBalances/index.ts (269 lines)
- src/collections/Accounts/index.ts (346 lines)
- src/collections/JournalEntries/index.ts (1080 lines)
- src/collections/FiscalYears/index.ts (401 lines)
- src/collections/Parties/index.ts (137 lines)
- src/utilities/journalSums.ts (38 lines)
- src/utilities/journalValidation.ts (62 lines)
- billing-seed.mjs (516 lines)
- test-apis.sh (304 lines)

## Finding 1 — Opening balances are never posted to the journal (Critical)

Issue: No opening journal entry is ever created for either opening-balance store
(`gl-accounts.openingBalance` per-account field or the `opening-balances` collection per-FY/per-account
records). `src/collections/JournalEntries/index.ts` contains zero references to "opening". The posting
engine, trial balance, ledger, P&L and balance-sheet endpoints all sum posted journal lines only.

Affected module:
- src/collections/JournalEntries/index.ts — trial-balance endpoint (line 70), ledger (line 143),
  profit-loss (line 242), balance-sheet (line 331); every report path calls `sumPostedByAccount` and
  nothing else.
- src/utilities/journalSums.ts (lines 9-37) — sums posted lines only; no opening-balance input.
- src/collections/Accounts/index.ts (lines 126-131) — /balances endpoint adds `a.openingBalance`
  arithmetically to posted sums: endpoint-local fiction with no matching journal entry.

Root cause: Opening balances exist only as data (a number field and a collection). No hook or endpoint
materializes them as posted journal-entry lines, so they never appear in double-entry movement.

Severity: Critical.

Proposed correction: Post an opening-balance journal entry (debit/credit lines signed by account type,
balanced to zero net) when opening balances are saved for a fiscal year, keyed to that FY with a
distinct reference (e.g. referenceDoc/marker "opening-balance"), and exclude it from void/reopen logic.
Then make trial balance / balance sheet / ledger include opening entries via the same sum path.

## Finding 2 — Two opening-balance stores never reconcile (High)

Issue: Two independent sources of opening balances exist, and they are never reconciled:
(a) `gl-accounts.openingBalance` — one number per account (Accounts/index.ts lines 306-312, seeded to
0 at line 236), described as the "point-in-time COA default" in OpeningBalances/index.ts lines 20-22;
(b) `opening-balances` collection — per fiscal year, per tenant, per account (OpeningBalances/index.ts
lines 236-265), written by the wizard (save-wizard) and by fiscal-year close (FiscalYears/index.ts
lines 277-291).

The /api/gl-accounts/balances endpoint (Accounts/index.ts lines 104-149, computation at lines 126-131)
uses only source (a). Source (b) is written by FY close but never read by /balances, trial balance,
balance sheet, or any report. After a fiscal-year close, the successor year's opening position lives
only in the opening-balances collection and is invisible to every balance report.

Affected module:
- src/collections/Accounts/index.ts lines 126-131 (balances computation ignores opening-balances
  collection)
- src/collections/FiscalYears/index.ts lines 252-266, 277-291 (close writes source (b) only)

Root cause: The balances endpoint was implemented against the legacy per-account field; the
FY-scoped opening-balances collection was added later with no read path wired into the reporting
endpoints.

Severity: High.

Proposed correction: Make /api/gl-accounts/balances (and trial balance / balance sheet) read the
opening-balances collection for the active fiscal year (falling back to gl-accounts.openingBalance
when no FY record exists), clearly documenting precedence so the two stores cannot diverge
unnoticed. Alternatively retire one store.

## Finding 3 — Sign convention for `opening-balances.amount` is inconsistent across three code paths (High)

Issue: The same `amount` column is interpreted with three different sign conventions:
- OpeningBalances/index.ts doc comment (lines 24-26): "assets/expenses carry debit-positive values,
  liabilities/equity/income credit-positive" — sign is tied to account normal balance.
- save-wizard validation (lines 103-116): `b.amount > 0` → debit bucket; `b.amount < 0` → credit
  bucket — sign is directional for every account type.
- FiscalYears close carry-forward (lines 282-287): comment says "universal convention:
  liability/equity credit balances are negative" — directional, opposite of the doc comment for
  credit-normal accounts.

A correctly balanced opening set per the doc comment (e.g. liability credit entered as a positive
number) fails save-wizard validation because positive amounts are classified as debits. Records
written by FY close (credit balances negative) would be re-interpreted by the wizard UI under the
doc's convention.

Affected module:
- src/collections/OpeningBalances/index.ts lines 24-26 (doc), 103-116 (save-wizard validation),
  218-225 (validate endpoint)
- src/collections/FiscalYears/index.ts lines 282-287 (close carry)

Root cause: The collection's documented convention was never aligned with the validation and
carry-forward code.

Severity: High.

Proposed correction: Adopt one convention — directional (positive = debit, negative = credit,
independent of account type) matches both save-wizard validation and FY close — update the doc
comment (lines 24-26) and ensure the SPA wizard displays/stores accordingly.

## Finding 4 — No closed-fiscal-year guard at collection level for opening-balances (Medium)

Issue: src/collections/OpeningBalances/index.ts hooks are only `beforeValidate: [assignTenant]`
(line 267-268). There is no `beforeChange` hook blocking create/update/delete of opening-balance
records for a closed fiscal year. The save-wizard endpoint checks `fy.status === 'closed'` (lines
128-130) and FiscalYears close checks its own status (line 215), but direct Payload writes and the
admin UI bypass both. Opening balances for a closed year can be altered or deleted silently, breaking
the reconciliation between closed years and carried-forward balances.

Affected module:
- src/collections/OpeningBalances/index.ts lines 266-268 (hooks)
- Related: src/collections/FiscalYears/index.ts lines 294-312 (close replaces successor-year records
  with no guard on the successor's status)

Root cause: Access control is endpoint-scoped; Payload collection hooks carry no period-lock rule.

Severity: Medium.

Proposed correction: Add a `beforeChange`/`beforeValidate` hook on opening-balances that rejects
writes when the linked fiscal year is closed (fetch fiscal-years by id, check status), with an
overrideAccess escape hatch only for the FY close endpoint itself.

## Finding 5 — Fiscal-year close carries forward without validating balance equality (Medium)

Issue: FiscalYears close endpoint (lines 199-342) computes year-end balances per account
(lines 277-291: `opening + debit - credit`) and writes them to the successor year's opening-balances
records without verifying (a) the current year's opening balances are balanced (debits == credits),
or (b) the year-end trial balance balances. An unbalanced opening position or unbalanced year is
carried forward silently. Income/expense accounts are correctly closed to zero (line 280).

Affected module:
- src/collections/FiscalYears/index.ts lines 248-291 (close computation)
- src/collections/OpeningBalances/index.ts lines 103-116 (balance check exists in save-wizard but is
  never invoked by close)

Root cause: Close assumes the caller pre-validated; no invariant check inside the close endpoint.

Severity: Medium.

Proposed correction: In the close endpoint, before writing carry-forward records, compute total debit
vs credit of the current year's opening-balances (and posted movements) and abort with a 400 if
|debit - credit| > 0.01, requiring the opening position to be balanced first.

## Finding 6 — save-wizard validates weakly; all-zero submission saves nothing (Low)

Issue: save-wizard (lines 93-100) requires fiscalYear, tenant, and a balances array, but never checks
that the listed accounts exist, are active, or belong to the tenant, nor that fiscalYear belongs to
the tenant. Zero amounts are skipped silently (lines 160-163), so a submission of all zeroes reports
`saved: 0` and persists nothing — test-apis.sh line 270 does exactly this (`"amount": 0`), so the
test suite never exercises a real non-zero opening-balance flow. Line 273 closes the FY with `|| true`,
masking close failures.

Affected module:
- src/collections/OpeningBalances/index.ts lines 93-175 (save-wizard)
- test-apis.sh lines 267-273 (opening-balance test)

Root cause: Validation limited to structural requirements; no referential or tenant scoping checks.

Severity: Low.

Proposed correction: Validate each balance account exists, is active, and matches the tenant; reject
or warn when all balances are zero; remove `|| true` from the close call in test-apis.sh and assert
the successor-year opening-balances were written.

## Observation — sumPostedByAccount hard-capped at 1000 entries (Low)

`src/utilities/journalSums.ts` line 18 uses `limit: 1000` with no pagination. Trial balance, balances,
ledger, P&L and balance-sheet silently understate once a tenant has more than 1000 posted journal
entries. Tangential to opening balances but affects every report that should reflect the opening
position.

## Summary

- Core defect: opening balances are never posted as journal entries — trial balance, balance sheet,
  P&L and ledger exclude them entirely (Finding 1).
- Secondary defect: /balances uses gl-accounts.openingBalance while FY close writes to the
  opening-balances collection; the two stores diverge and never reconcile (Finding 2).
- Sign convention for opening-balances.amount conflicts between doc, save-wizard validation, and
  FY close (Finding 3).
- No collection-level closed-year protection (Finding 4); close carries forward unbalanced positions
  (Finding 5); save-wizard lacks referential checks and the test seeds amount 0 (Finding 6).

No code was modified. Report file: OPENING_BALANCE_AUDIT.md at repo root.
