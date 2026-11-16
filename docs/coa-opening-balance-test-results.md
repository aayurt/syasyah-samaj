# COA & Opening Balances — QA Test Results
**Commit audited:** `3717476d` | **Environment:** Staging `syasha_staging` (82.165.181.153:5432) | **App:** https://staging.syasyahsamaj.com/
**Convention:** VERIFIED = actually checked against code/DB/build. BLOCKED = requires credentials not available; not executed — NOT reported as pass.

## Verification summary
| Category | Executed | Passed | Failed | Blocked (not executed) |
|----------|----------|--------|--------|------------------------|
| Code inspection (endpoints, validation, schema) | Yes | — | — | — |
| DB schema inspection (staging) | Yes | 0 | 2 (schema mismatch) | — |
| Build + unit tests | Yes | Build 0, vitest 611, jest 17 | 4 pre-existing (OrderDocTypes) | — |
| E2E workflow via UI/API | No | 0 | 0 | 42 (no auth credentials) |
| Security / permission via API | No | 0 | 0 | 8 (no auth credentials) |

## Test results

### Code inspection — verified against deployed source
| ID | Case | Status | Actual result (evidence) |
|----|------|--------|--------------------------|
| CODE-01 | `/save-wizard` saves DRAFT only, no journal | PASS (code) | `src/collections/OpeningBalances/index.ts:103-231` — inserts `status: 'draft'`, `postedToJournal: false`; no journal creation |
| CODE-02 | `/post` creates journal then marks balances posted | PASS (code) | lines 289-428 — creates `journal-entries` (status 'posted', date = FY start), then loops marking `status: 'posted'` |
| CODE-03 | `/post` NOT wrapped in transaction | FAIL | lines 289-428 — journal `create` then sequential `update` per balance; no `payload.transaction`. Partial failure → journal posted but some balances unmarked |
| CODE-04 | `/post` auto-absorbs rounding residual into equity | FAIL | lines 365-383 — residual > 0.001 absorbed into first equity account silently; unbalanced batch can post |
| CODE-05 | No `rejected` status / rejection reason field | FAIL | schema lines 650-657: status options = [draft, approved, posted, reversed]; no `rejected`, no `rejectionReason` field |
| CODE-06 | No role separation (approve vs post) | FAIL | lines 237, 296 — both `/approve` and `/post` gated by `isBillingUser` only |
| CODE-07 | `/save-wizard` deletes existing drafts silently | FAIL | lines 168-189 — deletes all non-posted records for FY+tenant before insert; no duplicate-submission rejection |
| CODE-08 | Save does not enforce Dr=Cr balance | FAIL | `validateOpeningBatch` called with `postingAllowed: false`; balance not enforced at save |

### DB schema inspection — verified via psql on staging
| ID | Case | Status | Actual result |
|----|------|--------|---------------|
| SCHEMA-01 | `opening_balances` has Slice C fields | FAIL | Table has only 7 legacy columns: id, account_id, fiscal_year_id, amount, tenant_id, created_at, updated_at. Missing: status, postedToJournal, createdBy, updatedBy, approvedBy, approvedAt, postedBy, postedAt, reversedBy, reversedAt, reversalReason, sourceBatch |
| SCHEMA-02 | `gl_accounts` has Slice A fields | FAIL | Table has only code, name, type. Missing: level, normalBalance, parentAccount (code references `level` in beforeValidate hook at Accounts/index.ts:124) |

### Build & tests — verified via terminal
| ID | Case | Status | Actual result |
|----|------|--------|---------------|
| BUILD-01 | `pnpm build` | PASS | exit 0 |
| BUILD-02 | billing vitest | PASS (with pre-existing) | 611 passed / 4 pre-existing failures (`OrderDocTypes.test.tsx` ×4, unrelated to COA/OB) |
| BUILD-03 | jest accountingValidation | PASS | 17 passed |
| BUILD-04 | Deploy staging + production | PASS | HEAD `3717476d` deployed; PM2 staging id 19 + production id 4; curl verified |

### E2E workflow — BLOCKED (no credentials)
The following require an authenticated session on https://staging.syasyahsamaj.com/. No credentials available; not executed; NOT reported as pass.

| ID | Case | Status |
|----|------|--------|
| OB-001 | Draft → validate → approve → post | BLOCKED |
| OB-002 | Rejection with mandatory reason | BLOCKED |
| OB-003 | Edit rejected draft, resubmit | BLOCKED |
| OB-004 | Unauthorized approval rejected | BLOCKED |
| OB-005 | Unauthorized posting rejected | BLOCKED |
| OB-006 | Duplicate submission rejected | BLOCKED |
| OB-007 | Duplicate posting rejected | BLOCKED |
| OB-008 | Post unbalanced batch rejected | BLOCKED |
| OB-009 | Post outside FY/open date rejected | BLOCKED |
| OB-010 | Post to inactive/non-posting account rejected | BLOCKED |
| OB-011 | Atomic posting | BLOCKED |
| OB-012 | Posted journal immutable | BLOCKED |
| OB-013 | Corrections use reversal | BLOCKED |
| OB-014 | Audit log complete | BLOCKED |
| OB-015 | OB batch Dr 1,400,000 / Cr 1,400,000 / diff 0 | BLOCKED |
| OB-016 | Trial Balance matches expected | BLOCKED |
| OB-017 | Balance Sheet balanced 1,380,000 | BLOCKED |
| OB-018 | AR subledger reconciliation | BLOCKED |
| OB-019 | AP subledger reconciliation | BLOCKED |
| OB-020 | Income Statement excludes opening | BLOCKED |
| COA-001…014 | COA hierarchy/structure/restrictions/classification | BLOCKED |
| NB-001…022 | Negative/boundary cases | BLOCKED |
| IM-001…016 | Import/export | BLOCKED |
| SEC-001…008 | Security/permission | BLOCKED |

## Blockers
1. No staging credentials → cannot execute any authenticated UI/API test.
2. Staging DB schema does not match deployed code (SCHEMA-01, SCHEMA-02) → authenticated endpoints writing `status`/`postedToJournal`/`level` would fail with column-not-found errors until migration runs.

## Evidence
- `src/collections/OpeningBalances/index.ts` (720 lines) — endpoints read in full.
- `src/utilities/accountingValidation.ts` — validation service read in full.
- Staging DB `psql \d opening_balances`, `\d gl_accounts` — column lists captured.
- `pnpm build`, `vitest`, `jest`, `pm2`, `curl` outputs captured in session history.