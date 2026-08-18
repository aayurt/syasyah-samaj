import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P6 asset management (docs/illaka/PLAN.md §14.9 — assets & liabilities).
 *
 * 1. Add depreciation accounts to billing_settings.
 * 2. Seed a "Depreciation Expense" (expense) and an "Accumulated
 *    Depreciation" (asset, org-wide under C00) gl account if missing, and
 *    point the global at them.
 * 3. Create the fixed_assets table and its depreciation_rows array table.
 *
 * Runs after P1 (C00 exists) and P3 (seeded-account pattern).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. billing_settings: depreciation accounts
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "depreciation_account_id" integer;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "accumulated_depreciation_account_id" integer;

    -- 2. Seed the depreciation accounts idempotently (org-wide / C00).
    INSERT INTO "gl_accounts" ("code", "name", "type", "class", "opening_balance", "active", "allow_manual_posting", "tenant_id", "created_at", "updated_at")
    SELECT 'DEP', 'Depreciation Expense', 'expense', 'other', 0, true, true, t.id, now(), now()
    FROM "tenants" t
    WHERE t."code" = 'C00'
      AND NOT EXISTS (SELECT 1 FROM "gl_accounts" WHERE "name" = 'Depreciation Expense');

    INSERT INTO "gl_accounts" ("code", "name", "type", "class", "opening_balance", "active", "allow_manual_posting", "tenant_id", "created_at", "updated_at")
    SELECT 'ACCUMDEP', 'Accumulated Depreciation', 'asset', 'other', 0, true, true, t.id, now(), now()
    FROM "tenants" t
    WHERE t."code" = 'C00'
      AND NOT EXISTS (SELECT 1 FROM "gl_accounts" WHERE "name" = 'Accumulated Depreciation');

    UPDATE "billing_settings"
    SET "depreciation_account_id" = (SELECT id FROM "gl_accounts" WHERE "name" = 'Depreciation Expense' LIMIT 1)
    WHERE "depreciation_account_id" IS NULL;

    UPDATE "billing_settings"
    SET "accumulated_depreciation_account_id" = (SELECT id FROM "gl_accounts" WHERE "name" = 'Accumulated Depreciation' LIMIT 1)
    WHERE "accumulated_depreciation_account_id" IS NULL;

    -- 3. fixed-assets collection
    CREATE TABLE IF NOT EXISTS "fixed_assets" (
      "id" serial PRIMARY KEY NOT NULL,
      "code" varchar,
      "name" varchar NOT NULL,
      "category" varchar DEFAULT 'other',
      "purchase_date" timestamp(3) with time zone,
      "purchase_cost" numeric DEFAULT 0,
      "salvage_value" numeric DEFAULT 0,
      "useful_life_years" numeric DEFAULT 5,
      "location" varchar,
      "status" varchar DEFAULT 'active',
      "tenant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "fixed_assets_depreciation_rows" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "amount" numeric NOT NULL,
      "journal_entry_id" integer
    );

    CREATE INDEX IF NOT EXISTS "fixed_assets_updated_at_idx" ON "fixed_assets" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "fixed_assets_created_at_idx" ON "fixed_assets" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "fixed_assets_tenant_idx" ON "fixed_assets" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "fixed_assets_rows_order_idx" ON "fixed_assets_depreciation_rows" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "fixed_assets_rows_parent_id_idx" ON "fixed_assets_depreciation_rows" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "fixed_assets_rows_journal_entry_idx" ON "fixed_assets_depreciation_rows" USING btree ("journal_entry_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "fixed_assets_depreciation_rows";
    DROP TABLE IF EXISTS "fixed_assets";

    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "accumulated_depreciation_account_id";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "depreciation_account_id";

    -- Only remove the seeded accounts when they have no journal usage, so a
    -- reversal of this migration can't strand entries.
    DELETE FROM "gl_accounts" g
    WHERE g."name" IN ('Depreciation Expense', 'Accumulated Depreciation')
      AND NOT EXISTS (SELECT 1 FROM "journal_entries_lines" l JOIN "journal_entries" j ON j."id" = l."_parent_id" WHERE l."account_id" = g."id");
  `)
}