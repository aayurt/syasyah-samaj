import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Add `normal_balance` to gl_accounts so contra accounts (e.g. Accumulated
 * Depreciation) can carry a credit normal balance. Defaults every row to
 * 'debit' so existing behaviour is unchanged.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "gl_accounts" ADD COLUMN IF NOT EXISTS "normal_balance" text DEFAULT 'debit'`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "gl_accounts" DROP COLUMN IF EXISTS "normal_balance"`,
  )
}
