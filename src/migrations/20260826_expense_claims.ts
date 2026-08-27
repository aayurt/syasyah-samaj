import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Expense Claims (P5) — employee expense reports with workflow states.
 *
 * Statuses: draft → submitted → approved → reimbursed (or rejected).
 * Billable expenses can be forwarded to customers as sales invoices.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "expense_claims" (
      "id" serial PRIMARY KEY,
      "claim_number" varchar NOT NULL UNIQUE,
      "claimant" varchar NOT NULL,
      "date" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'draft',
      "total_amount" numeric DEFAULT 0,
      "billable" boolean DEFAULT false,
      "party_id" integer REFERENCES "parties"("id") ON DELETE SET NULL,
      "billed_invoice_id" integer,
      "submitted_at" varchar,
      "approved_at" varchar,
      "approved_by" varchar,
      "rejected_at" varchar,
      "rejection_reason" varchar,
      "reimbursed_at" varchar,
      "journal_entry" integer,
      "payment_journal_entry" integer,
      "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE SET NULL,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "expense_claims_status_idx" ON "expense_claims" ("status");
    CREATE INDEX IF NOT EXISTS "expense_claims_tenant_idx" ON "expense_claims" ("tenant_id");
    CREATE INDEX IF NOT EXISTS "expense_claims_billable_idx" ON "expense_claims" ("billable");
    CREATE INDEX IF NOT EXISTS "expense_claims_party_idx" ON "expense_claims" ("party_id");
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "expense_claims_lines" (
      "id" serial PRIMARY KEY,
      "_order" integer NOT NULL DEFAULT 0,
      "_parent_id" integer NOT NULL REFERENCES "expense_claims"("id") ON DELETE CASCADE,
      "description" varchar,
      "amount" numeric NOT NULL DEFAULT 0,
      "account_id" integer REFERENCES "gl-accounts"("id") ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS "expense_claims_lines_parent_idx" ON "expense_claims_lines" ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "expense_claims_lines";
    DROP TABLE IF EXISTS "expense_claims";
  `)
}
