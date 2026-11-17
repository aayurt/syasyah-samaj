import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * The `level` field was added to the account-groups collection in f76d1937
 * without a matching migration. Dev databases picked it up via Payload's
 * push, but deployed databases did not, so any query selecting the field
 * (e.g. the P&L report) failed with "column account_groups.level does not exist".
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "account_groups" ADD COLUMN IF NOT EXISTS "level" numeric DEFAULT 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "account_groups" DROP COLUMN IF EXISTS "level";
  `)
}
