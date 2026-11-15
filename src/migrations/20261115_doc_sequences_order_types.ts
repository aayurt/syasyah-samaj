import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the order document types to the doc_sequences doc_type enum.
 *
 * Why this exists
 * ---------------
 * `nextNumber()` (src/collections/Documents/index.ts) assigns every voucher
 * number by inserting a row into `doc_sequences` with the document's type in
 * the `doc_type` column. That column is the Postgres enum
 * `enum_doc_sequences_doc_type`, which is generated from `DOC_TYPE_OPTIONS`
 * in src/collections/DocSequences/index.ts.
 *
 * The `20260818_p4_orders` migration added 'sales-order' and 'purchase-order'
 * to `enum_documents_doc_type` but not to `enum_doc_sequences_doc_type`, and
 * `DOC_TYPE_OPTIONS` did not list them either. The result: confirming any
 * sales order or purchase order failed with
 *
 *   invalid input value for enum enum_doc_sequences_doc_type: "sales-order"
 *
 * because `POST /documents/:id/confirm` never got as far as assigning the
 * order number. This migration repairs the enum on existing databases, and
 * `DOC_TYPE_OPTIONS` was updated to match so a fresh schema push creates the
 * same enum.
 *
 * It also adds the remaining document types the Documents collection supports,
 * so a number series can be created for every doc type that can be numbered:
 * sales-quote, petty-cash-voucher, membership-receipt and donation-receipt.
 *
 * ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
 * PostgreSQL versions, and Payload runs migrations in a transaction. To avoid
 * that, the enum is rebuilt with CREATE TYPE ... AS ENUM, which is
 * transactional and idempotent.
 *
 * The statement is assembled as plain SQL (no bind parameters) because the
 * value list is a literal list of enum labels — there is nothing user-supplied
 * in it, and PL/pgSQL dollar-quoted blocks do not mix well with bind
 * parameters.
 */
const ENUM_NAME = 'enum_doc_sequences_doc_type'

/** The values the enum had before this migration, in order. */
const OLD_VALUES = [
  'sales-invoice',
  'purchase-invoice',
  'receipt-voucher',
  'payment-voucher',
  'journal-voucher',
  'contra-voucher',
  'credit-note',
  'debit-note',
  'grn',
  'delivery-challan',
]

/**
 * The values this migration adds.
 *
 * `contra` is added alongside the existing `contra-voucher`: the Documents
 * collection uses `contra` for contra vouchers, so the sequence enum needs it
 * too. `contra-voucher` is kept so existing rows (and any series a user
 * created against it) keep working.
 */
const NEW_VALUES = [
  'sales-quote',
  'sales-order',
  'purchase-order',
  'petty-cash-voucher',
  'membership-receipt',
  'donation-receipt',
  'contra',
]

/** The full desired enum, in the order the collection declares it. */
const TARGET_VALUES = [
  'sales-quote',
  'sales-order',
  'sales-invoice',
  'purchase-order',
  'purchase-invoice',
  'receipt-voucher',
  'payment-voucher',
  'journal-voucher',
  'contra',
  'contra-voucher',
  'credit-note',
  'debit-note',
  'petty-cash-voucher',
  'grn',
  'delivery-challan',
  'membership-receipt',
  'donation-receipt',
]
/** Render a list of enum labels as a SQL string literal list. */
const literalList = (values: string[]) => values.map((v) => `'${v}'`).join(', ')

/**
 * Build the PL/pgSQL block that rebuilds the enum.
 *
 * `keep` decides which enum values survive: 'all' keeps everything, 'old'
 * keeps only the pre-migration values (the rollback).
 *
 * The rebuilt value list is assembled in plain SQL into `enum_list` as a
 * comma-separated list of single-quoted labels, then handed to EXECUTE. It is
 * built with string literals rather than quote_literal() because the result
 * has to be spliced into a CREATE TYPE statement.
 */
function buildEnumRebuild(keep: 'all' | 'old'): string {
  const keepClause =
    keep === 'all'
      ? ''
      : `AND e.enumlabel NOT IN (${literalList(NEW_VALUES)})`

  const additions =
    keep === 'all'
      ? `
          UNION
          SELECT v, 1000 + ord AS ord
          FROM unnest(ARRAY[${literalList(NEW_VALUES)}]::text[]) WITH ORDINALITY AS x(v, ord)
          WHERE v NOT IN (
            SELECT e.enumlabel
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = '${ENUM_NAME}'
          )`
      : ''

  const guard =
    keep === 'all'
      ? ''
      : `
      -- Every original value must still be present, otherwise the rollback
      -- would drop a value that rows rely on.
      IF EXISTS (
        SELECT 1
        FROM unnest(ARRAY[${literalList(OLD_VALUES)}]::text[]) AS v
        WHERE v NOT IN (
          SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = '${ENUM_NAME}'
        )
      ) THEN
        RAISE EXCEPTION 'cannot roll back: an original enum value is missing';
      END IF;`

  return `
DO $enum_rebuild$
DECLARE
  enum_list text;
BEGIN
  -- Is the enum there at all? A database created by the dev-mode schema push
  -- may already have the full set; a very old one may not have it.
  IF NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = '${ENUM_NAME}') THEN
    ${keep === 'all' ? `enum_list := ${literalList(TARGET_VALUES)};` : 'RETURN;'}
  ELSE
    SELECT string_agg('''' || v || '''', ', ' ORDER BY ord)
    INTO enum_list
    FROM (
      SELECT e.enumlabel AS v, e.enumsortorder AS ord
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = '${ENUM_NAME}'${keepClause}
      ${additions}
    ) s;
${guard}
  END IF;

  -- Nothing to do if the enum already matches.
  IF enum_list IS NULL THEN
    RETURN;
  END IF;

  -- Rebuild the enum with the merged value list. The column type stays
  -- "enum_doc_sequences_doc_type", so no data conversion is needed.
  ALTER TABLE "doc_sequences" ALTER COLUMN "doc_type" DROP DEFAULT;
  ALTER TABLE "doc_sequences" ALTER COLUMN "doc_type" TYPE text USING "doc_type"::text;
  DROP TYPE "public"."${ENUM_NAME}";
  EXECUTE 'CREATE TYPE "public"."${ENUM_NAME}" AS ENUM(' || enum_list || ')';
  ALTER TABLE "doc_sequences"
    ALTER COLUMN "doc_type" TYPE "public"."${ENUM_NAME}"
    USING "doc_type"::"public"."${ENUM_NAME}";
END
$enum_rebuild$;`
}

/** Exported for testing: the exact SQL this migration runs. */
export function buildUpSQL(): string {
  return buildEnumRebuild('all')
}

/** Exported for testing: the exact SQL the rollback runs. */
export function buildDownSQL(): string {
  return buildEnumRebuild('old')
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(buildEnumRebuild('all'))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(buildEnumRebuild('old'))
}
