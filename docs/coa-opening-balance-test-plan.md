# COA & Opening Balances — QA Test Plan
**Project:** Syasya Accounting (COA + Opening Balances, Slices A–E)
**Commit audited:** `3717476d` (origin/main, deployed to staging + production)
**Test company:** Syasya Demo Pvt. Ltd. (SYA001), Nepal, NPR, Accrual, FY 2083/84, open date 2026-07-17 AD
**Environment:** Staging DB `syasha_staging` on `82.165.181.153:5432` (isolated from production `syasha`)
**App:** `https://staging.syasyahsamaj.com/` (PM2 id 19, port 8086)

## Test environment (verified)
- Staging DB reachable; `opening_balances`, `gl_accounts`, `journal_entries`, `journal_entries_lines`, `fiscal_years`, `tenants`, `users`, `audit_logs` tables exist.
- Staging `opening_balances` table has **0 rows** and only 7 legacy columns (id, account_id, fiscal_year_id, amount, tenant_id, created_at, updated_at).
- Staging `gl_accounts` has only `code`, `name`, `type` columns (no `level`, `normalBalance`, `parentAccount`).
- Build: `pnpm build` exit 0. Billing vitest: 611 passed / 4 pre-existing failures. Jest accounting validation: 17 passed.
- Deploy: HEAD `3717476d` on staging (PM2 19) + production (PM2 4), verified via curl.

## Scope
In scope: COA hierarchy (5 levels), account restrictions, opening-balance workflow (draft→approved→posted→reversed), validation, posting, reversal, Trial Balance, Balance Sheet, AR/AP reconciliation, import/export, security/permissions, audit trail.
Out of scope: multi-currency FX (no live FX feed), payroll, fixed-asset depreciation calc.

## Test case index (COA)
| ID | Area | Case |
|----|------|------|
| COA-001 | Structure | Create all 5 hierarchy levels (Type→Group→Category→Control→Ledger) |
| COA-002 | Structure | Parent-child relationship integrity |
| COA-003 | Structure | Account code uniqueness within company/tenant |
| COA-004 | Restrictions | Duplicate account code rejected |
| COA-005 | Restrictions | Account without name rejected |
| COA-006 | Restrictions | Child under nonexistent parent rejected |
| COA-007 | Restrictions | Circular parent-child rejected |
| COA-008 | Restrictions | Post to non-posting account rejected |
| COA-009 | Restrictions | Delete account with children rejected |
| COA-010 | Restrictions | Delete account with ledger activity rejected |
| COA-011 | Classification | Assets/liabilities/equity on Balance Sheet |
| COA-012 | Classification | Income/expense on Income Statement |
| COA-013 | Classification | Contra-asset (accum. depreciation) credit normal balance |
| COA-014 | Classification | Parent aggregates child balances |

## Test case index (Opening Balances)
| ID | Area | Case |
|----|------|------|
| OB-001 | Workflow | Draft → validate → approve → post |
| OB-002 | Workflow | Rejection with mandatory reason |
| OB-003 | Workflow | Edit rejected draft, resubmit |
| OB-004 | Workflow | Unauthorized approval rejected |
| OB-005 | Workflow | Unauthorized posting rejected |
| OB-006 | Workflow | Duplicate submission rejected |
| OB-007 | Workflow | Duplicate posting rejected |
| OB-008 | Workflow | Post unbalanced batch rejected |
| OB-009 | Workflow | Post outside FY/open date rejected |
| OB-010 | Workflow | Post to inactive/non-posting account rejected |
| OB-011 | Workflow | Atomic posting (all-or-nothing) |
| OB-012 | Workflow | Posted journal cannot be silently edited/deleted |
| OB-013 | Workflow | Corrections use reversal/adjustment |
| OB-014 | Workflow | Audit log records every action |
| OB-015 | Data | Opening batch balances: Dr 1,400,000 / Cr 1,400,000 / diff 0 |
| OB-016 | Data | Trial Balance matches expected figures |
| OB-017 | Data | Balance Sheet: Assets 1,380,000 = L+E 1,380,000 |
| OB-018 | Data | AR subledger reconciles to Trade Receivables |
| OB-019 | Data | AP subledger reconciles to Trade Payables |
| OB-020 | Data | Income Statement excludes opening balances |

## Negative / boundary cases
NB-001 Dr exceeds Cr by NPR 1 · NB-002 Cr exceeds Dr by NPR 1 · NB-003 zero-value line · NB-004 negative amount · NB-005 both Dr+Cr on one line · NB-006 duplicate account line · NB-007 duplicate import · NB-008 invalid account code · NB-009 inactive account · NB-010 non-posting account · NB-011 missing customer/supplier allocation · NB-012 wrong subsidiary total · NB-013 invalid date · NB-014 date outside FY · NB-015 large amount · NB-016 decimal/rounding · NB-017 invalid currency · NB-018 missing FX rate · NB-019 concurrent edit · NB-020 browser refresh · NB-021 network failure · NB-022 retry idempotency

## Import/export
IM-001 correct template · IM-002 missing mandatory columns · IM-003 wrong headers · IM-004 duplicate codes · IM-005 invalid Dr/Cr · IM-006 unbalanced · IM-007 invalid dates · IM-008 invalid codes · IM-009 invalid party refs · IM-010 empty rows · IM-011 large file · IM-012 duplicate upload · IM-013 preview before commit · IM-014 row-level errors · IM-015 correction + revalidation · IM-016 export matches DB/UI

## Security (roles: admin, accountant, approver, read-only)
SEC-001 only authorized create/modify accounts · SEC-002 only authorized prepare OB · SEC-003 approval restricted to approvers · SEC-004 posting restricted to authorized · SEC-005 read-only cannot modify via UI or API · SEC-006 no cross-company access via ID tampering · SEC-007 company/branch isolation · SEC-008 sensitive actions audited

## Execution instructions
1. Provision test company FY 2083/84 on staging (does not touch production).
2. Run COA cases via UI + API; verify DB records directly.
3. Load OB dataset (11 accounts), run workflow cases; capture expected vs actual.
4. Run negative + import cases; record row-level errors.
5. Run security cases per role; verify backend authorization (not hidden buttons).
6. Query DB independently for Trial Balance / Balance Sheet; do not trust app reports as sole expected source.
7. Record every result in Doc B; log defects in Doc D.

## Exit criteria
All critical acceptance criteria in Doc E pass. Zero critical/high defects unremediated.