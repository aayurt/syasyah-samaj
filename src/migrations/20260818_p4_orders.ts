import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * P4 buying/selling orders (docs/illaka/PLAN.md — PO/SO workflow).
 *
 * 1. Extend the documents doc_type enum with 'sales-order' and
 *    'purchase-order'.
 * 2. Add order lifecycle columns: order_status, confirmed_at, cancelled_at.
 *
 * Orders are status-only documents (draft → confirmed → cancelled) that
 * never touch the journal; they are linked to their fulfilment documents
 * (challan/GRN/invoice) through the existing reference_to field.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. enum values (idempotent via DO block — ALTER TYPE cannot run
    --    conditionally in plain SQL).
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                     WHERE t.typname = 'enum_documents_doc_type' AND e.enumlabel = 'sales-order') THEN
        ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'sales-order' BEFORE 'sales-invoice';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                     WHERE t.typname = 'enum_documents_doc_type' AND e.enumlabel = 'purchase-order') THEN
        ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'purchase-order' BEFORE 'purchase-invoice';
      END IF;
    END $$;

    -- 2. order lifecycle columns
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "order_status" varchar DEFAULT 'draft';
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp(3) with time zone;
    ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "documents" DROP COLUMN IF EXISTS "cancelled_at";
    ALTER TABLE "documents" DROP COLUMN IF EXISTS "confirmed_at";
    ALTER TABLE "documents" DROP COLUMN IF EXISTS "order_status";

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'enum_documents_doc_type' AND e.enumlabel = 'sales-order') THEN
        ALTER TYPE "public"."enum_documents_doc_type" DROP VALUE 'sales-order';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'enum_documents_doc_type' AND e.enumlabel = 'purchase-order') THEN
        ALTER TYPE "public"."enum_documents_doc_type" DROP VALUE 'purchase-order';
      END IF;
    END $$;
  `)
}