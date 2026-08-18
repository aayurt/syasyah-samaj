import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P2 membership module (docs/illaka/PLAN.md §24).
 *
 * 1. Add membershipFeeAccount to billing_settings.
 * 2. Create membership-types table.
 * 3. Add membership columns to members (type, renewal, receipt, payment status, tenant).
 * 4. Seed 3 org-wide membership types (Basic/Standard/Premium).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. billing_settings: membership fee income account link
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "membership_fee_account_id" integer;
    UPDATE "billing_settings" SET "membership_fee_account_id" = 22
    WHERE "membership_fee_account_id" IS NULL;

    -- 2. membership-types (org-wide)
    CREATE TABLE IF NOT EXISTS "membership_types" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "fee" numeric NOT NULL,
      "period_months" integer DEFAULT 12,
      "description" text,
      "active" boolean DEFAULT true,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      CONSTRAINT "membership_types_name_unique" UNIQUE ("name")
    );
    CREATE INDEX IF NOT EXISTS "membership_types_created_at_idx" ON "membership_types" ("created_at");

    -- 3. members: P2 columns
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "membership_type_id" integer;
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "renewal_date" date;
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "last_receipt_id" integer;
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "payment_status" varchar DEFAULT 'unpaid';
    ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "tenant_id" integer;

    -- 4. Seed membership types
    INSERT INTO "membership_types" ("name", "fee", "period_months", "active", "created_at", "updated_at")
    VALUES
      ('Basic', 1000, 12, true, now(), now()),
      ('Standard', 2000, 12, true, now(), now()),
      ('Premium', 5000, 12, true, now(), now())
    ON CONFLICT ("name") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "membership_types" WHERE "name" IN ('Basic', 'Standard', 'Premium');
    DROP TABLE IF EXISTS "membership_types";

    ALTER TABLE "members" DROP COLUMN IF EXISTS "membership_type_id";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "renewal_date";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "last_receipt_id";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "payment_status";
    ALTER TABLE "members" DROP COLUMN IF EXISTS "tenant_id";

    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "membership_fee_account_id";
  `)
}
