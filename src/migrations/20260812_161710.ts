import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T16:17:10.643Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T16:17:10.643Z';
  ALTER TABLE "billing_settings" ADD COLUMN "freeze_date" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T15:48:14.942Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T15:48:14.942Z';
  ALTER TABLE "billing_settings" DROP COLUMN "freeze_date";`)
}
