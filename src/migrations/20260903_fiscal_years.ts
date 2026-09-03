import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fiscal years (Manager.io-style periods).
 *
 * 1. Create fiscal_years table (label, start/end, status, is_active, tenant).
 * 2. Link billing_settings.activeFiscalYear → fiscal_years.id.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. fiscal-years collection
    CREATE TABLE IF NOT EXISTS "fiscal_years" (
      "id" serial PRIMARY KEY,
      "label" varchar NOT NULL,
      "start_date" timestamp(3) with time zone NOT NULL,
      "end_date" timestamp(3) with time zone NOT NULL,
      "status" varchar DEFAULT 'active',
      "is_active" boolean DEFAULT false,
      "tenant_id" integer,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "fiscal_years_tenant_id_idx" ON "fiscal_years" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "fiscal_years_created_at_idx" ON "fiscal_years" ("created_at");
    CREATE INDEX IF NOT EXISTS "fiscal_years_start_date_idx" ON "fiscal_years" ("start_date");

    -- 2. billing_settings: working fiscal year link
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "active_fiscal_year_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "active_fiscal_year_id";
    DROP TABLE IF EXISTS "fiscal_years";
  `)
}