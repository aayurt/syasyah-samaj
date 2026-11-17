# Feature Specification: local-db-remigrate

**Feature Branch**: `[001-local-db-remigrate]`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "In Local I want to clean postgresql://nepse:nepse@localhost:5432/syasyah_samaj and remigrate everything and check if new data migration flow is working or not. The sample jsons should focus to be for ths syasyah samaj. the project is currently running on http://localhost:3000 always add the demo users and then do the tests..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean and remigrate local database (Priority: P1)

Developer wants to reset the local Syasyah Samaj Postgres database to a clean state and re-run all migrations so they can test the data migration flow from scratch.

**Why this priority**: This is the foundational step — without a clean, remigrated local DB, no migration-flow testing can proceed reliably.

**Independent Test**: Can be fully tested by executing the DB cleanup and migration commands locally and verifying the database schema is recreated without errors.

**Acceptance Scenarios**:

1. **Given** a local Postgres instance at `postgresql://nepse:nepse@localhost:5432/syasyah_samaj` with existing data, **When** the cleanup and remigrate process runs, **Then** all existing tables are dropped/recreated and the schema matches the current migration set.
2. **Given** a freshly remigrated database, **When** the application starts on `http://localhost:3000`, **Then** the app boots without schema mismatch errors.

---

### User Story 2 - Load sample JSON data for Syasyah Samaj (Priority: P2)

Developer wants to seed the remigrated local database with sample JSON data focused on Syasyah Samaj (Nepali community organization accounting/billing domain) to verify the data migration flow end-to-end.

**Why this priority**: Realistic domain-specific data is needed to validate that the migration flow handles Syasyah Samaj entities correctly.

**Independent Test**: Can be fully tested by importing sample JSON files and verifying records appear in the correct tables with expected relationships.

**Acceptance Scenarios**:

1. **Given** sample JSON files for Syasyah Samaj (chart of accounts, tenants, fiscal years, users, demo transactions), **When** the import process runs, **Then** all entities are created with correct field values and foreign-key relationships.
2. **Given** imported sample data, **When** the application is accessed at `http://localhost:3000`, **Then** the data is visible and usable in the UI.

---

### User Story 3 - Add demo users before testing (Priority: P1)

Developer wants demo users always created in the local database before running migration-flow tests, so test scenarios have authenticated user contexts.

**Why this priority**: Demo users are prerequisites for any authenticated testing — they must exist before tests run.

**Independent Test**: Can be fully tested by verifying demo user accounts exist in the database after setup and can sign in at `http://localhost:3000`.

**Acceptance Scenarios**:

1. **Given** a remigrated database, **When** demo user creation runs, **Then** predefined demo user accounts (email/password) exist and can authenticate.
2. **Given** demo users exist, **When** a test signs in at `http://localhost:3000`, **Then** the sign-in succeeds and the user is redirected to the dashboard.

---

### User Story 4 - Verify data migration flow works (Priority: P1)

Developer wants to confirm the new data migration flow (clean → migrate → seed → test) works end-to-end without data loss or corruption.

**Why this priority**: This is the core validation — the entire purpose of the feature is to confirm the migration flow is reliable.

**Independent Test**: Can be fully tested by running the complete flow and checking data integrity at each stage.

**Acceptance Scenarios**:

1. **Given** the complete local setup flow, **When** all steps complete successfully, **Then** the database contains all migrated structures and seeded data with no missing or orphaned records.
2. **Given** a completed migration flow, **When** the application is exercised at `http://localhost:3000`, **Then** core features (sign-in, data viewing) work without errors.

### Edge Cases

- What happens when the local Postgres instance is not running?
- How does the system handle partial migration failure (some tables created, others fail)?
- What happens when sample JSON files reference entities that don't exist yet (ordering dependencies)?
- How does system handle duplicate demo users on repeated runs?
- What happens when the application at `http://localhost:3000` is not running during verification?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST clean the local Postgres database at `postgresql://nepse:nepse@localhost:5432/syasyah_samaj` before remigration.
- **FR-002**: System MUST remigrate all database structures (tables, columns, indexes, constraints) matching the current migration set.
- **FR-003**: System MUST load sample JSON data focused on the Syasyah Samaj domain (chart of accounts, tenants, fiscal years, demo transactions).
- **FR-004**: System MUST create demo user accounts before tests run.
- **FR-005**: System MUST verify the data migration flow works end-to-end via the application at `http://localhost:3000`.
- **FR-006**: System MUST be idempotent — running the flow multiple times produces the same clean state.
- **FR-007**: System MUST report success/failure status for each step of the flow.

### Key Entities *(include if feature involves data)*

- **Database**: Local Postgres instance `syasyah_samaj` at `localhost:5432`, user `nepse`, password `nepse`.
- **Migration structure**: All database tables, columns, indexes, and constraints defined by the project's migration set.
- **Sample JSON files**: Domain-specific seed data for Syasyah Samaj (chart of accounts, tenants, fiscal years, users, demo transactions).
- **Demo users**: Predefined user accounts with email/password credentials for authenticated testing.
- **Application**: Syasyah Samaj billing/dashboard running at `http://localhost:3000`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Database cleanup and remigration completes without errors in under 5 minutes.
- **SC-002**: All sample JSON entities import successfully with zero rejected records.
- **SC-003**: Demo users can sign in at `http://localhost:3000` on first attempt.
- **SC-004**: Application loads core pages (dashboard, sign-in) at `http://localhost:3000` without schema or data errors.
- **SC-005**: Repeated runs of the full flow produce identical database state (idempotency).

## Assumptions

- Local Postgres is installed and accessible at `localhost:5432` with credentials `nepse/nepse`.
- The project is running at `http://localhost:3000` (Payload CMS + Next.js).
- Migration scripts are defined in the project's `src/migrations/` and can be applied via `pnpm db:setup` or equivalent.
- Sample JSON files follow the project's existing data import patterns.
- Demo user credentials are predefined and do not conflict with existing production data (local-only environment).
- This is a local development flow only — no production data is involved.
