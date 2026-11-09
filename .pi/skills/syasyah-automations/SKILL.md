---
name: syasyah-automations
description: Five syasyah-samaj billing automations — daily sync check, weekly schema drift, per-push i18n audit, E2E test loop, and weekly UI regression sweep.
---

# syasyah-automations

Five Cindy automation scripts for the syasyah-samaj billing SPA. Each script runs independently and exits non-zero when action is needed.

## Scripts

| Script | Purpose | Schedule |
|---|---|---|
| `scripts/daily-billing-sync.mjs` | Check IndexedDB outbox vs remote Postgres for unsynced invoices/payments | Daily 09:00 Asia/Kathmandu |
| `scripts/weekly-schema-drift.mjs` | Diff prod (82.165.181.153) vs E2E (localhost:5433) schema; flag drift | Weekly Monday 08:00 Asia/Kathmandu |
| `scripts/per-push-i18n-audit.mjs` | Verify en/ne key parity, duplicate `useT` imports, `.map(t)` shadowing | Manual (before each push) |
| `scripts/e2e-test-loop.mjs` | Run vitest + Playwright against E2E Postgres; report pass/fail | Every 6 hours |
| `scripts/ui-regression-sweep.mjs` | Flag `motion.div` usage and sub-44px touch targets | Weekly |

## Usage

Run any script directly:

```bash
node .pi/skills/syasyah-automations/scripts/per-push-i18n-audit.mjs
node .pi/skills/syasyah-automations/scripts/daily-billing-sync.mjs --app-url http://localhost:5173
node .pi/skills/syasyah-automations/scripts/weekly-schema-drift.mjs
node .pi/skills/syasyah-automations/scripts/e2e-test-loop.mjs
node .pi/skills/syasyah-automations/scripts/e2e-test-loop.mjs --vitest
node .pi/skills/syasyah-automations/scripts/e2e-test-loop.mjs --playwright
node .pi/skills/syasyah-automations/scripts/ui-regression-sweep.mjs
```

Exit codes: `0` = all clear / no action needed; `1` = issues found requiring attention; `2` = script error.

## Requirements

- **daily-billing-sync**: billing SPA running on `--app-url` (default `http://localhost:5173`); remote Postgres at `82.165.181.153:5432` (user `nepse`, db `syasha`); Playwright + Chrome installed.
- **weekly-schema-drift**: `psql` client; prod Postgres at `82.165.181.153:5432`; E2E Postgres at `localhost:5433` (user `postgres`, db `syasha_e2e`).
- **per-push-i18n-audit**: Node.js only (reads `apps/billing/src/lib/i18n/en.ts` and `ne.ts`, scans `apps/billing/src/`).
- **e2e-test-loop**: vitest + Playwright in `apps/billing/`; E2E Postgres at `localhost:5433` (db `syasha_e2e`). Does NOT touch remote Postgres.
- **ui-regression-sweep**: Node.js only (scans `apps/billing/src/`).

## Environment variables

- `SYASYA_APP_URL` — overrides the billing SPA URL for the daily sync check (default `http://localhost:5173`).
- `E2E_DATABASE_URI` — overrides the E2E database URI (default `postgresql://postgres:postgres@localhost:5433/syasha_e2e`).
