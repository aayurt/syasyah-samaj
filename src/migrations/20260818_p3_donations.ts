import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P3 donations module (docs/illaka/PLAN.md §6 — income classification).
 *
 * 1. Add donationAccount to billing_settings.
 * 2. Seed a "Donation Income" gl account (income, org-wide under C00) if
 *    missing, and point the global at it.
 *
 * Runs after P1 (C00 exists) and P2 (membership fields exist).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. billing_settings: donation income account link
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "donation_account_id" integer;

    -- 2. Seed the Donation Income account idempotently (org-wide / C00).
    INSERT INTO "gl_accounts" ("code", "name", "type", "class", "opening_balance", "active", "allow_manual_posting", "tenant_id", "created_at", "updated_at")
    SELECT 'DON', 'Donation Income', 'income', 'other', 0, true, true, t.id, now(), now()
    FROM "tenants" t
    WHERE t."code" = 'C00'
      AND NOT EXISTS (SELECT 1 FROM "gl_accounts" WHERE "name" = 'Donation Income');

    UPDATE "billing_settings"
    SET "donation_account_id" = (SELECT id FROM "gl_accounts" WHERE "name" = 'Donation Income' LIMIT 1)
    WHERE "donation_account_id" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "donation_account_id";

    -- Only remove the seeded account when it has no journal usage, so a
    -- reversal of this migration can't strand entries.
    DELETE FROM "gl_accounts" g
    WHERE g."name" = 'Donation Income'
      AND NOT EXISTS (SELECT 1 FROM "journal_entries_lines" l JOIN "journal_entries" j ON j."id" = l."_parent_id" WHERE l."account_id" = g."id");
  `)
}