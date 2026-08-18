import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P1 transfer infrastructure + P5 audit logs.
 *
 * 1. Add transferRef text column to journal_entries.
 * 2. Add createdByUser text column to journal_entries.
 * 3. Audit-logs table is created automatically by Payload schema push
 *    (the collection is registered in payload.config.ts).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "transfer_ref" varchar;
    CREATE INDEX IF NOT EXISTS "journal_entries_transfer_ref_idx" ON "journal_entries" ("transfer_ref");
    ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "created_by_user" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "transfer_ref";
    ALTER TABLE "journal_entries" DROP COLUMN IF EXISTS "created_by_user";
  `)
}
