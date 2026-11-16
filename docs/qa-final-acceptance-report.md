# QA Final Acceptance Report — COA & Opening Balances
**Commit audited:** `3717476d` (origin/main, deployed to staging + production)
**Decision:** FAIL — NOT ready for production release; NOT safe for user acceptance testing (UAT)

## Test execution totals
| Category | Executed | Passed | Failed | Blocked (not executed) |
|----------|----------|--------|--------|------------------------|
| Code inspection | Yes | — | 8 defects (2 critical, 3 high, 3 medium) | — |
| DB schema inspection | Yes | 0 | 2 (QA-001, QA-002) | — |
| Build + unit tests | Yes | Build 0, vitest 611, jest 17 | 4 pre-existing (unrelated OrderDocTypes) | — |
| E2E workflow (UI/API) | No | 0 | 0 | 42 (no credentials) |
| Security / permission | No | 0 | 0 | 8 (no credentials) |

## Critical & high-severity defects (unremediated)
- QA-001 Critical — Staging `opening_balances` missing all Slice C fields; posting will fail with column-not-found errors.
- QA-002 Critical — Staging `gl_accounts` missing Slice A fields (`level`, `normalBalance`, `parentAccount`).
- QA-003 High — `/post` not atomic (no transaction wrap).
- QA-004 High — `/post` auto-absorbs rounding residual into equity, masking imbalance.
- QA-005 High — No `rejected` status / rejection reason; rejection workflow not implemented.

## Actual vs expected financial results
| Metric | Expected | Actual | Match? |
|--------|----------|--------|--------|
| Debit total | NPR 1,400,000 | not posted | n/a |
| Credit total | NPR 1,400,000 | not posted | n/a |
| Opening difference | NPR 0 | not posted | n/a |
| Total Assets | NPR 1,380,000 | not posted | n/a |
| Total Liabilities | NPR 530,000 | not posted | n/a |
| Total Equity | NPR 850,000 | not posted | n/a |
| Balance Sheet balanced | yes | not posted | n/a |
| AR subledger = control | 250,000 | not posted | n/a |
| AP subledger = control | 180,000 | not posted | n/a |

**Actual results unavailable:** no authenticated access to staging app; staging DB schema does not match deployed code.

## Trial Balance result
Not executed (blocked). Expected: Dr 1,400,000 = Cr 1,400,000, difference 0.

## Balance Sheet result
Not executed (blocked). Expected: Assets 1,380,000 = Liabilities 530,000 + Equity 850,000, balanced.

## AR/AP reconciliation result
Not executed (blocked). Expected: AR 250,000 = Trade Receivables control; AP 180,000 = Trade Payables control, exact match.

## Security & data integrity result
Not executed (blocked — no credentials). Code review found: no role separation between approver/poster (QA-006), no duplicate-submission rejection (QA-007), no balance enforcement at save (QA-008). Backend authorization not verified live.

## Acceptance criteria verdict (from test plan #12)
| Criterion | Required | Result |
|-----------|----------|--------|
| COA hierarchy correct | pass | not verified (blocked) |
| Invalid operations rejected | pass | not verified (blocked) |
| Opening batch validation | pass | not verified (blocked) |
| Debit total 1,400,000 | pass | not posted |
| Credit total 1,400,000 | pass | not posted |
| Opening difference 0 | pass | not posted |
| Posted journal balanced + unique | pass | not posted |
| Trial Balance matches | pass | not verified |
| Total Assets 1,380,000 | pass | not verified |
| Total Liabilities 530,000 | pass | not verified |
| Total Equity 850,000 | pass | not verified |
| Balance Sheet balanced | pass | not verified |
| AR reconciliation exact | pass | not verified |
| AP reconciliation exact | pass | not verified |
| Audit trail complete | pass | not verified |
| Company isolation | pass | not verified |
| Duplicate posting prevented | pass | not verified |

## Release recommendation
**DO NOT release to production.** Do not proceed to UAT.

Remediation required before re-test:
1. Apply Slice A + Slice C migrations to staging DB (resolve QA-001, QA-002).
2. Fix `/post` atomicity (QA-003), remove auto-residual absorption (QA-004), add rejection workflow (QA-005).
3. Add role separation (QA-006), duplicate-draft guard (QA-007), balance enforcement at save (QA-008).
4. Obtain staging credentials and re-run all 42 blocked E2E + 8 security tests.
5. Verify Trial Balance / Balance Sheet / AR-AP reconciliation match expected figures.
6. Add regression tests for QA-003…QA-008; rerun full billing vitest + jest suite.
7. Re-deploy to staging only after all pass; production deploy only after UAT sign-off.

## Sign-off
QA decision: FAIL. Critical defects unremediated; financial results unverified; E2E not executed.