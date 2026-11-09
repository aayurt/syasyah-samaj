# Cindy Teammates & Loop Automations — syasyah-samaj

## Missing teammates to create in Cindy UI

Open Cindy → Companions/Teammates → New → fill each below. All use **Pi harness**, **9router** provider, **nemotron-3-ultra-550b-a55b** model, `skillMode: allowlist` (inherit all), `toolsetMode: inherit`, `mcpMode: inherit`, `permissions: auto`.

| # | Name | Role / Identity | Working dir |
|---|------|----------------|-------------|
| 1 | **Engineering Delivery Teammate** (exists) | Follows delegated code work, ties commits/checks/delivery evidence | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj` |
| 2 | **Prototype Teammate** (exists) | Turns ideas/revisions into reviewable interface deliveries | same |
| 3 | **Product QA Teammate** (exists) | Walks test product, remembers known issues | same |
| 4 | **Code Audit Teammate** (exists) | Checks code scope, separates reproducible issues from noise | same |
| 5 | **OCTOGENT** (exists) | General assistant | same |
| 6 | **Billing / Accounting Teammate** (NEW) | Owns billing SPA logic: invoice math, payment tracking, offline-first IndexedDB sync conflicts, `t`-shadowing/i18n crash guards in `apps/billing/src` | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing` |
| 7 | **Database Integrity Teammate** (NEW) | Remote Postgres (82.165.181.153) + Docker E2E `:5433` (syasha_e2e) schema drift, migration health (bloodGroup `text` enum), prod vs E2E data consistency | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj` |
| 8 | **i18n / Nepali Localization Teammate** (NEW) | `lib/i18n/{en,ne}.ts` key parity, default `ne`, no interpolation, catch missing translations, guard duplicate `import { useT }` | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing/src/lib` |
| 9 | **E2E / Test Loop Teammate** (NEW) | Drives test runs against `:5433` E2E DB, catches regressions before push to origin main | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj` |
| 10 | **Release Teammate** (NEW) | PR hygiene, commit checks, deploy triggers via `./deploy.sh [api\|front\|all]` to PersonalVPS | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj` |
| 11 | **UI Improver Teammate** (NEW) | framer-motion `@types/react@19` `className` fix (use `MotionDiv` alias), mobile-first card actions/touch targets, Tailwind parity with design system, duplicate-import lint | `/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing/src` |

## Loop automations to attach (Cindy → Automations → New Automation)

| Automation | Teammate | Schedule | Prompt summary |
|------------|----------|----------|----------------|
| Daily billing sync check | Billing / Accounting | Daily 09:00 Asia/Kathmandu | Compare IndexedDB cache vs remote Postgres for unsynced invoices/payments; surface conflicts |
| Weekly schema drift report | Database Integrity | Weekly Mon 08:00 | `pg_dump` schema from 82.165.181.153 vs Docker `:5433`; flag drift, enum mismatches (bloodGroup) |
| Per-push i18n key audit | i18n / Nepali | On-demand / pre-push | Verify `en` and `ne` dict keys match; flag missing translations; scan for duplicate `import { useT }` |
| E2E test loop | E2E / Test Loop | Every 6h + pre-push | Run test suite against `:5433`; report failures, block merge if red |
| UI regression sweep | UI Improver | Weekly | Scan `apps/billing/src` for `motion.div` className loss, mobile touch targets <44px, duplicate imports |

## How to create in Cindy UI

1. **Companions/Teammates**: New → paste identity + role → pick Pi harness / nemotron-3-ultra-550b-a55b / 9router → save.
2. **Automations**: New Automation → Blank → title + prompt → pick teammate → Schedule: Automatic (cron or relative interval) → Run session: New each run → Run now to test → Enable.
3. Turn on **Keep computer awake** in Settings > General > App Behavior for overnight reliability.

## Verification

After creating, check `schedule_runs` table in `~/Library/Application Support/CindyGlobal/cindy-cmvutujj20efwrx014nx1zqdc.db` for new schedule rows and successful run statuses.
