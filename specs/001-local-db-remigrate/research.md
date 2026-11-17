# Research: local-db-remigrate

**Feature**: Clean and remigrate local Syasyah Samaj database, seed sample JSON data, add demo users, verify migration flow.

**Date**: 2026-11-17

---

## Decision 1: Database cleanup and remigration approach

**Decision**: Use Payload CMS dev-mode schema push via `pnpm db:setup` (existing `scripts/db-setup.ts`) for remigration, preceded by a SQL cleanup step that drops all public tables. Add two new scripts: `scripts/seed-local.ts` for sample JSON seeding and `scripts/clear-local-data.ts` for clearing data while preserving accounting users.

**Rationale**: `db:setup` already exists and boots the Payload config against the target DB, waits for the push to complete, and is idempotent. It requires `DATABASE_URI`, `NODE_ENV=development`, and placeholder `RESEND_API_KEY`/`PAYLOAD_SECRET`. The cleanup step needs raw SQL (Postgres `DROP TABLE ... CASCADE`) because Payload's push only adds missing tables, it does not drop existing ones.

**Alternatives considered**:
- `payload migrate` — rejected because the migration chain has ordering dependencies (migration #14 inserts into `tax_types` before the table is created by migration #21), so it cannot bootstrap cleanly on an empty DB.
- `payload generate:db-schema` — rejected because it only writes a TypeScript file and does not create database tables.

---

## Decision 2: Sample JSON data scope and format

**Decision**: Sample JSON files focus on Syasyah Samaj domain entities: chart of accounts (COA with 5 levels), tenants, fiscal years, users, and demo transactions. JSON files live in `scripts/seeds/` and follow the project's existing field naming (Nepali i18n keys where applicable).

**Rationale**: The spec requires Syasyah Samaj-focused data for testing the migration flow. Using the project's existing collection field names ensures compatibility with Payload collections.

**Alternatives considered**:
- CSV import — rejected because Payload collections are JSON-oriented and the project has no CSV import infrastructure.
- Hardcoded seed in migration — rejected because migrations should be structural only; seed data belongs in separate scripts.

---

## Decision 3: Demo user creation

**Decision**: Predefined demo users created via the seed script with email/password credentials. Demo users are created before tests run and are idempotent (skip if email already exists).

**Rationale**: Demo users are prerequisites for authenticated testing. They must exist before the application can be exercised at `http://localhost:3000`.

**Alternatives considered**:
- Create demo users via Payload admin UI — rejected because it's manual and not repeatable/idempotent.
- Use production demo credentials — rejected because this is local-only; no production data involved.

---

## Decision 4: UI clear-data button (preserving accounting users)

**Decision**: Add a "Clear All Data" button in the billing SPA that triggers a confirmation dialog requiring the user to type "CLEAR ALL DATA", with a production guard and a server-side endpoint that deletes all non-user accounting data while preserving users related to accounting.

**Rationale**: The user requested a button to clear all data except accounting-related users. A confirmation dialog prevents accidental data loss. The production guard ensures this never runs against production.

**Alternatives considered**:
- Client-side only clear — rejected because data deletion requires server-side DB access.
- No confirmation dialog — rejected because destructive actions require user confirmation per safety best practices.

---

## Decision 5: Verification approach

**Decision**: Verify end-to-end by booting the app at `http://localhost:3000`, signing in as a demo user, and confirming core pages (dashboard, accounts, members) load without schema or data errors.

**Rationale**: No dedicated automated test framework is configured for this flow. Manual browser verification is the available validation method.

**Alternatives considered**:
- Playwright/automated E2E — rejected because no E2E test infrastructure exists in the project; adding it is out of scope for this feature.
- Unit tests on seed scripts — rejected because the scripts are thin wrappers around DB operations; integration verification via the running app is more valuable.
