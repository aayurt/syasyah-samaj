import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Data-fix migration (2026-09-09): clear empty-string bloodGroup values
 * before the text→select (enum) migration runs.
 *
 * Existing rows with id_card_details_blood_group = '' cannot be cast to the
 * new enum type. Setting them to NULL allows the schema migration to proceed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "members"
    SET "id_card_details_blood_group" = NULL
    WHERE "id_card_details_blood_group" = '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // No-op: NULL values are valid for the enum type
}
