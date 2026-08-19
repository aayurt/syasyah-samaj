import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P2 tally vouchers + tax system.
 *
 * 1. Seed a default VAT tax type (nature additive, 13%) scoped to the C00
 *    central tenant so the multiple-tax system has a working default and the
 *    SPA tax picker has something to show out of the box.
 * 2. Backfill the legacy single-rate documents: any posted/draft document
 *    with tax_rate > 0 and no tax lines gets a tax_lines row referencing the
 *    default VAT type (rate = tax_rate, base = net_total, amount = tax_total).
 *
 * The tables themselves (tax_types, documents_tax_lines, from_account_id /
 * to_account_id on documents) are created by Payload schema push.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Seed the default VAT tax type on the C00 central tenant.
  await db.execute(sql`
    INSERT INTO "tax_types" ("code", "name", "nature", "rate", "active", "tenant_id")
    SELECT 'VAT', 'VAT', 'additive', 13, true, "t"."id"
    FROM "tenants" "t"
    WHERE "t"."code" = 'C00'
      AND NOT EXISTS (SELECT 1 FROM "tax_types" WHERE "code" = 'VAT')
  `)

  // Backfill legacy documents carrying a single tax_rate.
  await db.execute(sql`
    INSERT INTO "documents_tax_lines"
      ("_order", "_parent_id", "id", "tax_type_id", "nature", "rate", "base_amount", "amount")
    SELECT
      0,
      "d"."id",
      substr(md5(random()::text || ':' || "d"."id"::text), 1, 24),
      "v"."id",
      'additive',
      "d"."tax_rate",
      "d"."net_total",
      "d"."tax_total"
    FROM "documents" "d"
    JOIN "tax_types" "v" ON "v"."code" = 'VAT'
    WHERE "d"."tax_rate" > 0
      AND NOT EXISTS (
        SELECT 1 FROM "documents_tax_lines" "tl" WHERE "tl"."_parent_id" = "d"."id"
      )
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Remove backfilled tax lines (those on documents that carry a legacy
  // tax_rate) and drop the seeded default VAT type.
  await db.execute(sql`
    DELETE FROM "documents_tax_lines" "tl"
    USING "documents" "d", "tax_types" "v"
    WHERE "tl"."_parent_id" = "d"."id"
      AND "tl"."tax_type_id" = "v"."id"
      AND "d"."tax_rate" > 0
      AND "v"."code" = 'VAT'
  `)
  await db.execute(sql`
    DELETE FROM "tax_types" WHERE "code" = 'VAT'
  `)
}