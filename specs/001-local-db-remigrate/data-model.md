# Data Model: local-db-remigrate

**Feature**: Clean and remigrate local Syasyah Samaj database, seed sample JSON data, add demo users, verify migration flow.

**Date**: 2026-11-17

---

## Entities

### Database (syasyah_samaj)

**Represents**: The local Postgres instance hosting all Payload CMS collections and custom tables.

**Key attributes**:
- Host: `localhost`
- Port: `5432`
- Database name: `syasyah_samaj`
- User: `nepse`
- Password: `nepse`

**Relationships**: Contains all Payload CMS collections (users, tenants, accounts, etc.) plus custom tables from migrations (opening_balance_batches, opening_balance_lines, etc.).

---

### Migration Structure

**Represents**: All database tables, columns, indexes, and constraints defined by the project's migration set in `src/migrations/`.

**Key attributes**:
- Numbered migration files (sequential, e.g., `20261117_110000_coa_opening_balance_batches_lines.ts`)
- Registered in `src/migrations/index.ts`
- Payload migration records in `payload_migrations` table

**Relationships**: Each migration may create tables, add columns, or create indexes/constraints that reference other collections via foreign keys.

---

### Sample JSON Files

**Represents**: Domain-specific seed data for Syasyah Samaj (chart of accounts, tenants, fiscal years, users, demo transactions).

**Key attributes**:
- Location: `scripts/seeds/`
- Format: JSON arrays matching Payload collection field names
- Entities: chart_of_accounts, tenants, fiscal_years, users, demo_transactions

**Relationships**: JSON records reference each other via foreign keys (e.g., transactions reference accounts and tenants).

---

### Demo Users

**Represents**: Predefined user accounts with email/password credentials for authenticated testing.

**Key attributes**:
- Email: predefined demo email addresses
- Password: predefined demo passwords
- Role: accounting-related user roles (admin, moderator, member)

**Relationships**: Demo users belong to tenants and may be associated with accounting data they created.

---

### Clear-Data Scope (preserving accounting users)

**Represents**: The set of data that can be cleared while preserving users related to accounting.

**Included (cleared)**:
- All transaction data (journals, vouchers, lines)
- Chart of accounts (except system accounts)
- Tenants (except default)
- Fiscal years
- Opening balances
- All non-user entities

**Excluded (preserved)**:
- User accounts (authentication credentials, profiles)
- User roles and permissions
- System-required accounts

**Relationships**: Clearing cascades to dependent records (e.g., deleting a tenant removes its transactions but not its users).

---

## Validation Rules

- Database cleanup must drop all public tables with `CASCADE` to handle foreign key dependencies
- Remigration must match the current migration set exactly (no missing or extra tables)
- Sample JSON import must respect entity ordering (parents before children: tenants before transactions, accounts before journal lines)
- Demo user creation must be idempotent (skip if email already exists)
- Clear-data operation must preserve all user accounts and their authentication data
- Clear-data operation requires explicit confirmation ("CLEAR ALL DATA") and production guard

---

## State Transitions

- **Database state**: existing → cleaned → remigrated → seeded → verified
- **Demo user state**: not created → created → authenticated (sign-in verified)
- **Data state**: populated → cleared (users preserved) → re-seeded
