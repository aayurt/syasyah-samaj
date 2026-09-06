import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Data-fix migration (2026-09-06): repair fiscal-year dates that were stored
 * one day early by the pre-fix BS→AD conversion.
 *
 * Root cause: `bsToAdString()` truncated `toJsDate().toISOString()`, which in
 * Nepal time (UTC+5:45) is 18:15 UTC of the *previous* day — so a fiscal year
 * entered in BS mode (e.g. start 2082-04-01 / Shrawan 1) was saved as the AD
 * date one day earlier than the true calendar date (2025-07-16 instead of
 * 2025-07-17). The bug also made typed BS dates display one day back.
 *
 * Only rows entered through the BS input path are affected; rows created in
 * AD mode (or after the partial fix) are correct. So this migration does NOT
 * blindly add a day. It updates a row only when the stored date equals the
 * known-wrong value, verified against the label's true fiscal year
 * (start = Shrawan 1 of the label year; end = Asar 31 = day before Shrawan 1
 * of the following year). Idempotent: re-running changes nothing.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Rows verified against the BS calendar on 2026-09-06:
  //   id 4 (2078-79): start 2021-07-15 → true 2021-07-16, end OK
  //   id 3 (2081-82): start 2024-07-15 → true 2024-07-16, end OK
  //   id 2 (2082-83): start + end already correct (AD-mode entry) — untouched
  //   id 1 (2083-84): start 2026-07-16 → true 2026-07-17,
  //                   end 2027-07-16 → true 2027-07-15
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2021-07-16 00:00:00+00', "updated_at" = now()
    WHERE "id" = 4 AND "start_date" = '2021-07-15 00:00:00+00';
  `)
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2024-07-16 00:00:00+00', "updated_at" = now()
    WHERE "id" = 3 AND "start_date" = '2024-07-15 00:00:00+00';
  `)
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2026-07-17 00:00:00+00', "end_date" = '2027-07-15 00:00:00+00', "updated_at" = now()
    WHERE "id" = 1 AND "start_date" = '2026-07-16 00:00:00+00';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2021-07-15 00:00:00+00', "updated_at" = now()
    WHERE "id" = 4 AND "start_date" = '2021-07-16 00:00:00+00';
  `)
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2024-07-15 00:00:00+00', "updated_at" = now()
    WHERE "id" = 3 AND "start_date" = '2024-07-16 00:00:00+00';
  `)
  await db.execute(sql`
    UPDATE "fiscal_years" SET "start_date" = '2026-07-16 00:00:00+00', "end_date" = '2027-07-16 00:00:00+00', "updated_at" = now()
    WHERE "id" = 1 AND "start_date" = '2026-07-17 00:00:00+00';
  `)
}