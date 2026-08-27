import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Recurring billing schedules.
 *
 * Stores template configurations that auto-generate invoices on a schedule
 * (weekly, monthly, quarterly, yearly). The billing SPA manages these; a
 * cron endpoint (/recurring-schedules/tick) processes due schedules.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "recurring_schedules" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "doc_type" varchar NOT NULL DEFAULT 'sales-invoice',
      "frequency" varchar NOT NULL DEFAULT 'monthly',
      "day_of_month" integer,
      "party_id" integer REFERENCES "parties"("id") ON DELETE SET NULL,
      "tax_rate" numeric DEFAULT 0,
      "narration" text,
      "start_date" varchar NOT NULL,
      "end_date" varchar,
      "next_run_date" varchar NOT NULL,
      "last_run_date" varchar,
      "last_doc_id" integer,
      "status" varchar NOT NULL DEFAULT 'active',
      "generated_count" integer DEFAULT 0,
      "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "recurring_schedules_status_idx"
      ON "recurring_schedules" ("status");
    CREATE INDEX IF NOT EXISTS "recurring_schedules_next_run_idx"
      ON "recurring_schedules" ("next_run_date");
    CREATE INDEX IF NOT EXISTS "recurring_schedules_tenant_idx"
      ON "recurring_schedules" ("tenant_id");
  `)

  // Lines array is stored as a separate table (Payload array pattern)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "recurring_schedules_lines" (
      "id" serial PRIMARY KEY,
      "_order" integer NOT NULL DEFAULT 0,
      "_parent_id" integer NOT NULL REFERENCES "recurring_schedules"("id") ON DELETE CASCADE,
      "description" varchar,
      "qty" numeric DEFAULT 1,
      "rate" numeric NOT NULL DEFAULT 0,
      "amount" numeric,
      "item_id" integer REFERENCES "items"("id") ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS "recurring_schedules_lines_parent_idx"
      ON "recurring_schedules_lines" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "recurring_schedules_lines";
    DROP TABLE IF EXISTS "recurring_schedules";
  `)
}
