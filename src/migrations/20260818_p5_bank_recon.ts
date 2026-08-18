import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P5 bank reconciliation (docs/illaka/PLAN.md — BRS).
 *
 * 1. Create the bank_statements table (+ its rows array table).
 * 2. Add cleared / cleared_at to journal_entries.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bank_statements" (
      "id" serial PRIMARY KEY NOT NULL,
      "account_id" integer,
      "period_start" timestamp(3) with time zone,
      "period_end" timestamp(3) with time zone,
      "opening_balance" numeric DEFAULT 0,
      "closing_balance" numeric DEFAULT 0,
      "tenant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "bank_statements_rows" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "description" varchar,
      "reference" varchar,
      "amount" numeric NOT NULL,
      "matched_entry_id" integer
    );

    -- journal-entries: reconciliation flags
    ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "cleared" boolean DEFAULT false;
    ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "cleared_at" timestamp(3) with time zone;

    -- indexes
    CREATE INDEX IF NOT EXISTS "bank_statements_updated_at_idx" ON "bank_statements" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "bank_statements_created_at_idx" ON "bank_statements" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "bank_statements_rows_order_idx" ON "bank_statements_rows" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "bank_statements_rows_parent_id_idx" ON "bank_statements_rows" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "bank_statements_rows_matched_entry_idx" ON "bank_statements_rows" USING btree ("matched_entry_id");
    CREATE INDEX IF NOT EXISTS "journal_entries_cleared_idx" ON "journal_entries" USING btree ("cleared");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "journal_entries_cleared_idx";
    DROP INDEX IF EXISTS "bank_statements_rows_matched_entry_idx";
    DROP INDEX IF EXISTS "bank_statements_rows_parent_id_idx";
    DROP INDEX IF EXISTS "bank_statements_rows_order_idx";
    DROP INDEX IF EXISTS "bank_statements_created_at_idx";
    DROP INDEX IF EXISTS "bank_statements_updated_at_idx";

    ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "cleared_at";
    ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "cleared";

    DROP TABLE IF EXISTS "bank_statements_rows";
    DROP TABLE IF EXISTS "bank_statements";
  `)
}