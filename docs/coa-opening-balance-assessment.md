# COA & Opening Balances — Implementation Assessment

## Existing implementation inventory

**Backend (Payload CMS 3.75, `/src/collections/`)**
- `gl-accounts` — code, name, group, type, class, openingBalance, active, allowManualPosting, normalBalance, parent, tenant. `validateAccount` hook rejects self-parent, duplicate code per tenant, parent cycles (50-hop bound). `/balances` endpoint returns net balance per account (opening + posted journals, signed by type). `/seed-defaults` seeds ~30 flat accounts.
- `account-groups` — code, name, type, parent, description, sortOrder, tenant. Tree hierarchy. `/seed-defaults` seeds the standard 5-level-ish group tree.
- `opening-balances` — account, fiscalYear, amount (signed), postedToJournal, tenant. `/for-year`, `/save-wizard` (balanced check, posts to `journal-entries` on FY start date, marks postedToJournal), `/validate`. Hook rejects closed fiscal years.

**Frontend (billing SPA, `/apps/billing/src/`)**
- `pages/Accounts.tsx` — tree/table view, account create/edit form, CoaSetupModal, CSV import/export modals, per-account opening balance map.
- `pages/SetupOpeningBalances.tsx` — grid of debits/credits per account for selected FY, saves via `/save-wizard`.
- `pages/Vouchers.tsx`, `VoucherStepper.tsx`, `Journal.tsx`, `TrialBalance.tsx`, `Aging.tsx` — transaction/reporting layer.
- `lib/journalValidation.ts`, `lib/journalSums.ts` — rounding (`round2`, `toNum`), per-account posted sums.

## Requirement-to-code mapping

| Spec item | Status | Location |
|---|---|---|
| 5 account types (asset/liability/equity/income/expense) | exists | `accountTypeOptions` in `AccountGroups/index.ts`, reused in `Accounts/index.ts` |
| Normal balance debit/credit | exists | `normalBalance` field on `gl-accounts` |
| 5-level hierarchy (Type→Group→Category→Control→Ledger) | partial | single `parent` field on both accounts and groups; no level calc, no level cap, no level labels |
| Unique account code per company | exists | `validateAccount` unique-code check per tenant |
| Parent-company mismatch, self-parent, cycle rejection | exists | `validateAccount` (self-parent, cycle); no explicit parent-company check |
| Posting allowed / non-posting accounts | partial | `allowManualPosting` field; no enforcement at journal-posting time |
| Account subtypes | missing | no subtype field |
| Cost centre / branch / currency on account | missing | none on `gl-accounts` |
| Opening balances separate from COA master | partial | separate `opening-balances` collection exists, BUT `gl-accounts.openingBalance` also stores a balance on the master (redundant) |
| Debit/credit cannot both be positive; negative amounts rejected | partial | `save-wizard` signs amounts by sign; no explicit "both positive" or negative check |
| Batch balanced before posting | exists | `save-wizard` checks debit==credit |
| Draft→Approve→Posted workflow | missing | `save-wizard` saves + posts immediately; no status/approval |
| Posted balances immutable; reversal/adjustment journals | missing | none |
| Excel import/export | partial | CSV import/export modals exist (`parseImportFile`, `ImportPreviewModal`, `ExportModal`); not Excel |
| Centralized validation service (codes, severity, suggestions) | missing | ad-hoc checks inline |
| Automated tests for COA/opening balances | missing | none in `test/` for these modules |

## Identified defects

1. **Redundant opening balance storage.** `gl-accounts.openingBalance` (number on master) and `opening-balances.amount` (separate collection) both exist. Spec says don't store editable balances on COA master. Risk: double-counting or divergence.
2. **No parent-company validation.** `validateAccount` checks self-parent and cycles but not that the parent belongs to the same tenant/company.
3. **No posting-time enforcement.** `allowManualPosting` is a UI flag only; nothing stops a journal line hitting a non-posting/heading account.
4. **Immediate post on save.** `save-wizard` posts to `journal-entries` synchronously with no approval step, no reversal path, and no idempotency guard (re-saving deletes + recreates).
5. **Hierarchy is single-parent only.** No level calculation, no "accounts with children cannot be deleted," no "non-posting accounts cannot receive journals."

## Missing functionality

- Approval workflow (Draft → Validate → Submit → Pending Approval → Approved → Posted) with rejection reason.
- Reversal/adjustment journals for posted opening balances.
- Account subtypes, currency, cost centre, branch fields.
- Centralized validation service with validation codes + suggested corrections.
- Excel (not just CSV) import/export with row-level errors and downloadable error report.
- Balance Sheet / Trial Balance generated from posted ledger (not hardcoded).
- Account tree with level labels, expand/collapse, "posting allowed" enforcement.

## Database gaps

- No `level` / `hierarchyLevel` column on accounts or groups.
- No subtype column on accounts.
- No unique constraint combining code+tenant at DB level (only app-level hook).
- `opening-balances` has no status/approval/audit fields (status, approvedBy, postedBy, batchNumber, reference).
- No reversal/adjustment journal linkage.

## Accounting risks

- Double-counting opening balances if both `gl-accounts.openingBalance` and `opening-balances` are summed in reports.
- Posting to heading/non-posting accounts corrupts trial balance.
- Re-saving opening balances deletes and recreates; no audit trail of who changed what.
- Immediate post with no approval means a single user can alter opening positions.

## Proposed implementation plan (small, verifiable slices)

1. **Slice A — Cleanup:** Deprecate `gl-accounts.openingBalance` (keep field but stop writing to it; single source of truth = `opening-balances` collection). Add `level` field + DB index; compute level on save.
2. **Slice B — Validation service:** Central `src/utilities/accountingValidation.ts` with validation codes/severity/suggestions; reuse in `validateAccount` and opening-balance save.
3. **Slice C — Opening balance workflow:** Add `status` (draft|submitted|approved|posted|rejected), `approvedBy`, `postedBy`, `rejectionReason`, `batchNumber` to `opening-balances`; split save-wizard into draft-save / approve / post (atomic transaction) / reverse.
4. **Slice D — Import/export:** Excel import with row-level errors + downloadable error report (extend existing CSV modals).
5. **Slice E — Tests:** COA + opening-balance tests per spec (valid/invalid parent, cycle, unbalanced batch, approval, atomic post, reversal).
6. **Slice F — Reports:** Balance Sheet / Trial Balance from posted ledger balances (no hardcoding).

## Files expected to change

- `src/collections/Accounts/index.ts` — level field, parent-company check, posting-time guard.
- `src/collections/AccountGroups/index.ts` — level field.
- `src/collections/OpeningBalances/index.ts` — status/audit fields, split save-wizard endpoints, reversal endpoint.
- `src/utilities/accountingValidation.ts` — new validation service.
- `apps/billing/src/pages/Accounts.tsx` — level display, subtype/currency fields.
- `apps/billing/src/pages/SetupOpeningBalances.tsx` — approval workflow UI.
- `apps/billing/src/lib/types.ts` — new field types.
- Tests: `apps/billing/src/test/` (or existing test dir).

## Immediate question

Do you want me to start with **Slice A** (level field + deprecate `openingBalance` on the master), or pick a different slice first?
