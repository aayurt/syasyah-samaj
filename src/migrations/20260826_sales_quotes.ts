import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sales Quote module (Manager.io-style quote → invoice flow).
 *
 * 1. Add 'sales-quote' to the documents doc_type enum (non-posting,
 *    status-only document like orders).
 * 2. Add documents.source_quote_id — set on invoices created from a quote,
 *    giving traceability ("this invoice came from quote SQ-…").
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_documents_doc_type" ADD VALUE IF NOT EXISTS 'sales-quote';
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "source_quote_id" integer;
    CREATE INDEX IF NOT EXISTS "documents_source_quote_idx" ON "documents" ("source_quote_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Enum values cannot be removed in Postgres; leave them.
  await db.execute(sql`
    DROP INDEX IF EXISTS "documents_source_quote_idx";
    ALTER TABLE "documents" DROP COLUMN IF EXISTS "source_quote_id";
  `)
}
