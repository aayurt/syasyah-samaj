# Quickstart: local-db-remigrate

**Feature**: Clean and remigrate local Syasyah Samaj database, seed sample JSON data, add demo users, verify migration flow.

**Date**: 2026-11-17

---

## Prerequisites

- Local Postgres running at `localhost:5432`
- Database `syasyah_samaj` exists (or will be created)
- Postgres credentials: user `nepse`, password `nepse`
- Project at `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj`
- `pnpm` installed
- Application reachable at `http://localhost:3000` (for verification step)

---

## Setup Commands

### 1. Set environment variables

```bash
export DATABASE_URI="postgresql://nepse:nepse@localhost:5432/syasyah_samaj"
export NODE_ENV=development
export PAYLOAD_MIGRATING=false
export RESEND_API_KEY="re_db_setup_placeholder"
export PAYLOAD_SECRET="db-setup-placeholder-secret"
```

### 2. Clean the local database

Drops all tables in the `public` schema to start from a clean state:

```bash
psql "$DATABASE_URI" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### 3. Remigrate all database structures

Pushes the Payload CMS schema against the target database:

```bash
cd /Users/aayurtshrestha/Projects/supreme/syasyah-samaj
pnpm db:setup
```

Expected: script exits 0, all collection tables created without errors.

### 4. Seed sample JSON data

Imports Syasyah Samaj-focused sample data (chart of accounts, tenants, fiscal years, demo transactions, demo users):

```bash
pnpm tsx scripts/seed-local.ts
```

Expected: all entities imported with zero rejected records; demo users created.

### 5. Verify demo users can sign in

Open `http://localhost:3000` in a browser and sign in with a demo user email/password.

Expected: sign-in succeeds, redirect to dashboard.

### 6. Verify core pages load

Navigate to dashboard, accounts, and members pages.

Expected: pages load without schema or data errors.

### 7. Test clear-data button (preserving accounting users)

Click "Clear All Data" button in the billing SPA, type "CLEAR ALL DATA" in the confirmation dialog, and confirm.

Expected: all non-user data cleared, user accounts preserved, app still functional.

### 8. Idempotency check

Repeat steps 2–5. Database state should be identical after each run.

---

## Expected Outcomes

| Step | Success Indicator |
|------|-------------------|
| Clean | `DROP SCHEMA` completes without error |
| Remigrate | `pnpm db:setup` exits 0, all tables present |
| Seed | All sample JSON entities imported, demo users exist |
| Sign-in | Demo user authenticates at `http://localhost:3000` |
| Pages | Dashboard, accounts, members load without errors |
| Clear-data | Non-user data cleared, users preserved |
| Idempotency | Repeated runs produce identical state |

---

## References

- Feature spec: [`spec.md`](spec.md)
- Data model: [`data-model.md`](data-model.md)
- Research findings: [`research.md`](research.md)
- Payload CMS config: `src/payload.config.ts`
- DB setup script: `scripts/db-setup.ts`
