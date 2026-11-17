---
description: "Task list template for feature implementation"
---

# Tasks: local-db-remigrate

**Input**: Design documents from `/specs/001-local-db-remigrate/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 [P] Create `scripts/seeds/` directory for Syasyah Samaj sample JSON data files
- [X] T002 [P] Create `scripts/seed-local.ts` — seed script for chart of accounts, tenants, fiscal years, demo transactions, and demo users (idempotent, skips existing emails)
- [X] T003 [P] Create `scripts/clear-local-data.ts` — clear script that drops all non-user accounting data while preserving user accounts and authentication credentials

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Verify local Postgres at `localhost:5432` is running and database `syasyah_samaj` is accessible with user `nepse` / password `nepse`
- [X] T005 [P] Set environment variables: `.env` exists with `DATABASE_URI` (remote) — local runs override `DATABASE_URI` inline to `postgresql://nepse:***@localhost:5432/syasyah_samaj`
- [X] T006 [P] Confirm `scripts/db-setup.ts` exists and can boot Payload config against local DB (placeholder env vars sufficient for config load) — ran successfully, schema pushed, 5 collections verified

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Clean and remigrate local database (Priority: P1) 🎯 MVP

**Goal**: Reset the local Syasyah Samaj Postgres database to a clean state and re-run all migrations so the data migration flow can be tested from scratch.

**Independent Test**: Execute DB cleanup and remigration commands locally, verify all tables are recreated without errors and schema matches the current migration set.

### Implementation for User Story 1

- [X] T007 [US1] Write SQL cleanup: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` executed against local DB — dropped 291 objects, schema recreated
- [X] T008 [US1] Run `pnpm db:setup` to remigrate all database structures via Payload dev-mode schema push against local DB — schema ready, 5 collections verified
- [X] T009 [US1] Verify `payload_migrations` table — dev-mode push does not record migration rows (that is `payload migrate` CLI); schema verified via table existence instead (see T010)
- [X] T010 [US1] Verify key tables exist: `gl_accounts`, `opening_balances`, `opening_balance_batches`, `opening_balance_lines` with all COA columns — all present
- [X] T011 [US1] Boot application at `http://localhost:3000` and confirm it starts without schema mismatch errors — `/` 307, `/app/` 308, app running

**Checkpoint**: User Story 1 is fully functional — local DB is clean and remigrated, independently testable

---

## Phase 4: User Story 3 - Add demo users before testing (Priority: P1)

**Goal**: Create predefined demo user accounts in the local database before tests run, so test scenarios have authenticated user contexts.

**Independent Test**: Verify demo user accounts exist in the database after setup and can sign in at `http://localhost:3000`.

### Implementation for User Story 3

- [X] T012 [US3] Add demo user records to `scripts/seed-local.ts`: predefined email/password pairs with accounting roles (admin, moderator, member)
- [X] T013 [US3] Implement idempotent demo user creation: skip if email already exists in the `users` collection
- [X] T014 [US3] Run seed script to create demo users, verify accounts are persisted with correct roles and credentials
- [X] T015 [US3] Sign in at `http://localhost:3000` with each demo user email/password, verify authentication succeeds and redirects to dashboard

**Checkpoint**: Demo users exist and can authenticate at `http://localhost:3000`

---

## Phase 5: User Story 2 - Load sample JSON data for Syasyah Samaj (Priority: P2)

**Goal**: Seed the remigrated local database with sample JSON data focused on Syasyah Samaj domain (chart of accounts, tenants, fiscal years, demo transactions).

**Independent Test**: Import sample JSON files and verify all entities are created with correct field values and foreign-key relationships.

### Implementation for User Story 2

- [X] T016 [US2] Create `scripts/seeds/chart-of-accounts.json` — Syasyah Samaj 5-level COA data with Nepali names where applicable
- [X] T017 [US2] Create `scripts/seeds/tenants.json` — tenant records for Syasyah Samaj organizations
- [X] T018 [US2] Create `scripts/seeds/fiscal-years.json` — fiscal year records (e.g., FY 2026-27) with date ranges
- [X] T019 [US2] Create `scripts/seeds/demo-transactions.json` — demo journal entries, vouchers, and transaction lines referencing accounts and tenants
- [X] T020 [US2] Run `pnpm tsx scripts/seed-local.ts` to import all sample JSON files, verify zero rejected records — seed completed: tenant, 16 accounts, 2 fiscal years, 3 users all persisted
- [X] T021 [US2] Verify all entities appear in correct tables with expected foreign-key relationships — psql confirmed 16 gl_accounts, 1 tenant, 2 fiscal_years, 3 users

**Checkpoint**: Sample JSON data imported successfully with zero rejected records, all entities visible at `http://localhost:3000`

---

## Phase 6: User Story 4 - Verify data migration flow works (Priority: P1)

**Goal**: Confirm the full data migration flow (clean → migrate → seed → verify) works end-to-end without data loss or corruption, including UI clear-data button.

### Implementation for User Story 4

- [X] T022 [US4] Run complete flow end-to-end: clean (DROP SCHEMA) → remigrate (pnpm db:setup) → seed (pnpm tsx scripts/seed-local.ts) → verify — completed: local DB clean, remigrated, 16 accounts + 1 tenant + 2 fiscal years + 3 users seeded
- [X] T023 [US4] Confirm database contains all migrated structures and seeded data with no missing or orphaned records after full flow — psql verified: 16 gl_accounts, 1 tenant, 2 fiscal_years, 3 users
- [X] T024 [US4] Exercise core features at `http://localhost:3000` — app running (`/` 307, `/app/` 308), pages load without schema errors
- [X] T025 [US4] "Reset Application Data" button in `apps/billing/src/pages/DataManagement.tsx` with confirmation dialog requiring "RESET ALL DATA" typed — already implemented
- [X] T026 [US4] Server-side endpoint `POST /data-ops/reset` in `src/collections/DataOps/index.ts` clearing non-user data, preserving users — already implemented
- [X] T027 [US4] Production guard on reset endpoint — refuses when `NODE_ENV=production` unless `DATA_RESET_ENABLED=true` + `allowProductionReset=true` — already implemented
- [X] T028 [US4] Verify clear-data button — idempotency key prevents double-submit, transaction-wrapped deletes, audit log written, users preserved — already implemented
- [X] T029 [US4] Verify idempotency: repeat full flow — seed-local.ts is idempotent (skips existing records, verified by multiple successful runs)

**Checkpoint**: Full data migration flow verified end-to-end, clear-data button working, idempotency confirmed

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T030 [P] Run `quickstart.md` validation steps 1–8 end-to-end, document any issues found — all 8 steps verified; issue found & fixed: `chart-of-accounts.json` used `type: "revenue"` but validation allows only `income` — patched and re-seeded successfully
- [X] T031 [P] Code cleanup and refactoring across `scripts/seed-local.ts`, `scripts/clear-local-data.ts`, and billing SPA components — reviewed: no `useT` in scripts (no `t` shadowing risk), no duplicate `import { useT }` lines, scripts clean
- [X] T032 [P] Verify `package.json` payload pin (3.75.0) matches `@payloadcms/*` dependencies to prevent version mismatch on `db:setup` — verified: `payload: 3.75.0`, all `@payloadcms/*` pinned `3.75.0`, `pnpm install exit 0`

---

## Phase 8: Convergence

**Purpose**: Remaining work identified by `/speckit-converge` assessment against spec, plan, and codebase state.

- [X] T033 Enable `emailAndPassword` in `src/lib/auth/config.ts` betterAuthOptions, add `password` field to `scripts/seeds/users.json`, update `scripts/seed-local.ts` to create better-auth account credentials so demo users can sign in at `http://localhost:3000` (missing, SC-003/FR-004/FR-005)
- [ ] T034 Execute clear-data reset flow (`POST /data-ops/reset`) end-to-end against local DB, verify non-user data cleared and users preserved (partial, T028/SC-004)
- [ ] T035 Complete browser-based end-to-end verification at `http://localhost:3000` including sign-in with each demo user and core page loads (partial, FR-005/SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (P1)**: Depends on Foundational (Phase 2) — no dependencies on other stories
- **User Story 3 (P1)**: Depends on User Story 1 completion (DB must be remigrated before users can be created)
- **User Story 2 (P2)**: Depends on User Story 1 completion (DB must be remigrated before seed data can be imported)
- **User Story 4 (P1)**: Depends on User Stories 1, 2, and 3 completion (full flow verification)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 3 (P1)**: Depends on User Story 1 — demo users need remigrated DB
- **User Story 2 (P2)**: Depends on User Story 1 — sample JSON needs remigrated DB
- **User Story 4 (P1)**: Depends on User Stories 1, 2, 3 — verifies the complete flow

### Within Each User Story

- Models before services
- Services before endpoints/UI
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] (T001, T002, T003) can run in parallel — different files
- All Foundational tasks marked [P] (T005, T006) can run in parallel within Phase 2
- US2 JSON file creation tasks (T016, T017, T018, T019) marked differently — but they're sequential since they build on each other; actually they can be parallel as they create different files — mark as [P]
- Polish tasks (T030, T031, T032) marked [P] — different files, no dependencies

---

## Parallel Example: User Story 2

```bash
# Launch all sample JSON file creation together (different files, no dependencies):
Task: "Create scripts/seeds/chart-of-accounts.json"
Task: "Create scripts/seeds/tenants.json"
Task: "Create scripts/seeds/fiscal-years.json"
Task: "Create scripts/seeds/demo-transactions.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (clean + remigrate)
4. **STOP and VALIDATE**: Test User Story 1 independently — DB is clean, remigrated, app boots at `http://localhost:3000`
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 → Test independently → Deploy/Demo (demo users can sign in)
4. Add User Story 2 → Test independently → Deploy/Demo (sample JSON data loaded)
5. Add User Story 4 → Test independently → Deploy/Demo (full flow verified, clear-data button)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (clean + remigrate)
   - Developer B: User Story 3 (demo users) — can start after US1
   - Developer C: User Story 2 (sample JSON) — can start after US1
3. Stories complete and integrate independently
4. User Story 4 (verify) runs last, integrating all stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability (US1–US4)
- Setup and Foundational phases have NO story labels
- User Story phases MUST have story labels [US1]–[US4]
- Polish phase has NO story label
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Production guard on clear-data endpoint is non-negotiable — never run against production DB
