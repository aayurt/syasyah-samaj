import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P1 illaka foundation (§23 of docs/illaka/PLAN.md).
 *
 * 1. Add the illaka-dimension columns to `tenants` (code / type / active).
 * 2. Seed the central C00 row (type=central) with localized names.
 * 3. Backfill every existing single-book billing row to `tenant_id = C00`.
 *
 * Runs BEFORE the `required` + scoping hooks are active so the backfill
 * itself is not blocked.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. New columns (idempotent).
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "type" varchar DEFAULT 'illaka';
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
    CREATE UNIQUE INDEX IF NOT EXISTS "tenants_code_idx" ON "tenants" ("code");

    -- 2. Seed the central C00 row (idempotent — keyed on code).
    -- NB: name is localized and lives in tenants_locales, not the base table.
    INSERT INTO "tenants" ("slug", "enabled", "code", "type", "active", "created_at", "updated_at")
    SELECT 'central-organization', false, 'C00', 'central', true, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "tenants" WHERE "code" = 'C00');

    INSERT INTO "tenants_locales" ("name", "description", "_locale", "_parent_id")
    SELECT 'Central Organization', NULL, l.locale, t.id
    FROM "tenants" t
    CROSS JOIN (VALUES ('en'::_locales), ('ne'::_locales), ('new'::_locales)) AS l(locale)
    WHERE t.code = 'C00'
      AND NOT EXISTS (
        SELECT 1 FROM "tenants_locales" tl
        WHERE tl._parent_id = t.id AND tl._locale = l.locale
      );

    -- 3. Backfill all existing single-book rows to C00.
    UPDATE "gl_accounts"      SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    UPDATE "documents"        SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    UPDATE "journal_entries"  SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    UPDATE "parties"          SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    UPDATE "items"            SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    UPDATE "stock_movements"  SET "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00') WHERE "tenant_id" IS NULL;
    -- account-groups stay org-wide (shared COA taxonomy); their tenant_id
    -- is left NULL by design and the field will be dropped later.
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Safe unwind: drop the backfill, the C00 row, and the new columns.
  await db.execute(sql`
    -- Reverse the backfill FIRST while C00 still exists.
    UPDATE "gl_accounts"      SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');
    UPDATE "documents"        SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');
    UPDATE "journal_entries"  SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');
    UPDATE "parties"          SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');
    UPDATE "items"            SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');
    UPDATE "stock_movements"  SET "tenant_id" = NULL WHERE "tenant_id" = (SELECT id FROM "tenants" WHERE "code" = 'C00');

    DELETE FROM "tenants_locales" WHERE "_parent_id" IN (SELECT id FROM "tenants" WHERE "code" = 'C00');
    DELETE FROM "tenants" WHERE "code" = 'C00';

    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "code";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "type";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "active";
  `)
}
