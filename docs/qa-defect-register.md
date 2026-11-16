# QA Defect Register — COA & Opening Balances
**Commit audited:** `3717476d` | **Severity:** Critical / High / Medium / Low

| ID | Severity | Module | Reproduction steps | Expected | Actual | Root cause | Fix applied | Retest |
|----|----------|--------|-------------------|----------|--------|------------|-------------|--------|
| QA-001 | Critical | OpeningBalances DB | Deploy code to staging; inspect `opening_balances` table | Table has `status`, `postedToJournal`, `createdBy`, `updatedBy`, `approvedBy`, `postedBy`, `reversedBy`, `reversalReason`, `sourceBatch` columns | Only 7 legacy columns exist (id, account_id, fiscal_year_id, amount, tenant_id, created_at, updated_at) | Slice C migration not applied to staging DB | Run Payload migration / add missing columns to `opening_balances` | Pending |
| QA-002 | Critical | COA DB | Inspect `gl_accounts` table on staging | Table has `level`, `normalBalance`, `parentAccount` columns | Only `code`, `name`, `type` exist | Slice A migration not applied to staging DB | Add missing columns to `gl_accounts` | Pending |
| QA-003 | High | `/post` endpoint | Post an approved batch; kill process mid-way after journal create but before all balances marked | Atomic: journal + all balances posted, or none | Journal created; balances marked sequentially with no transaction wrap | `src/collections/OpeningBalances/index.ts:289-428` — no `payload.transaction` wrap | Wrap journal create + balance marks in one Payload transaction; rollback on any failure | Pending |
| QA-004 | High | `/post` endpoint | Post a batch where Dr ≠ Cr by a small residual | Reject unbalanced batch | Residual silently absorbed into first equity account | lines 365-383 auto-absorbs residual into equity without user approval | Reject batch if `Dr ≠ Cr`; do not auto-absorb; require adjustment journal | Pending |
| QA-005 | High | OpeningBalances schema/workflow | Attempt to reject a draft batch with a reason | `rejected` status + `rejectionReason` recorded | No `rejected` status; no `rejectionReason` field (only draft/approved/posted/reversed) | Schema lacks `rejected` option and `rejectionReason` field | Add `rejected` status + `rejectionReason` text field; implement reject endpoint | Pending |
| QA-006 | Medium | Authorization | Call `/approve` then `/post` as same billing user | Approval restricted to approvers; posting restricted to poster role | Both gated by `isBillingUser`; no role separation | lines 237, 296 — same guard for both endpoints | Separate roles: approver → `/approve`; poster → `/post` | Pending |
| QA-007 | Medium | `/save-wizard` | Save draft for FY+tenant that already has a draft | Duplicate submission rejected | Existing drafts deleted silently (lines 168-189) | No duplicate-draft guard; unconditional delete | Reject if draft already exists; require explicit replace | Pending |
| QA-008 | Medium | `validateOpeningBatch` | Save an unbalanced batch (Dr ≠ Cr) | Balance enforced at save | Balance not enforced at save (only at `/validate`, not at save/post) | `validateOpeningBatch` called with `postingAllowed: false`; no Dr=Cr enforcement | Enforce Dr=Cr at save for posting-intent batches | Pending |

## Defect totals
- Critical: 2 (QA-001, QA-002 — schema mismatch blocks all posting)
- High: 3 (QA-003, QA-004, QA-005 — atomicity, balance masking, rejection workflow)
- Medium: 3 (QA-006, QA-007, QA-008 — role separation, duplicate guard, balance enforcement)
- Low: 0

## Remediation order
1. Apply Slice A + Slice C migrations to staging DB (QA-001, QA-002).
2. Wrap `/post` in transaction (QA-003).
3. Remove auto-residual absorption; reject unbalanced (QA-004).
4. Add `rejected` status + `rejectionReason` (QA-005).
5. Role separation approve vs post (QA-006).
6. Duplicate-draft guard (QA-007).
7. Enforce Dr=Cr at save (QA-008).