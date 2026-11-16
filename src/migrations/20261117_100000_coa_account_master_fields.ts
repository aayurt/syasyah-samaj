import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 — COA account-master fields (additive, no data loss).
 *
 * Adds spec §5 fields to gl_accounts without touching existing columns.
 * company <-> tenant mapping: spec `company_id` == existing `tenant` (no
 * duplicate companies table). account audit reuses existing `audit-logs`
 * (entityType='account') — no duplicate account_audit_logs table.
 *
 * Monetary amounts stay on opening-balances (numeric) — no float here.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gl_accounts" ADD COLUMN "status" text NOT NULL DEFAULT 'active';
   ALTER TABLE "gl_accounts" ADD COLUMN "financial_statement" text;
   ALTER TABLE "gl_accounts" ADD COLUMN "posting_allowed" boolean NOT NULL DEFAULT true;
   ALTER TABLE "gl_accounts" ADD COLUMN "control_account" boolean NOT NULL DEFAULT false;
   ALTER TABLE "gl_accounts" ADD COLUMN "reconciliation_required" boolean NOT NULL DEFAULT false;
   ALTER TABLE "gl_accounts" ADD COLUMN "cost_centre_required" boolean NOT NULL DEFAULT false;
   ALTER TABLE "gl_accounts" ADD COLUMN "branch_required" boolean NOT NULL DEFAULT false;
   ALTER TABLE "gl_accounts" ADD COLUMN "currency_code" text NOT NULL DEFAULT 'NPR';
   ALTER TABLE "gl_accounts" ADD COLUMN "effective_from" date;
   ALTER TABLE "gl_accounts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
   CREATE INDEX "gl_accounts_status_idx" ON "gl_accounts" USING btree ("status");
   CREATE INDEX "gl_accounts_deleted_at_idx" ON "gl_accounts" USING btree ("deleted_at");
   CREATE INDEX "gl_accounts_financial_statement_idx" ON "gl_accounts" USING btree ("financial_statement");
 `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "gl_accounts_financial_statement_idx";
   DROP INDEX "gl_accounts_deleted_at_idx";
   DROP INDEX "gl_accounts_status_idx";
   ALTER TABLE "gl_accounts" DROP COLUMN "deleted_at";
   ALTER TABLE "gl_accounts" DROP COLUMN "effective_from";
   ALTER TABLE "gl_accounts" DROP COLUMN "currency_code";
   ALTER TABLE "gl_accounts" DROP COLUMN "branch_required";
   ALTER TABLE "gl_accounts" DROP COLUMN "cost_centre_required";
   ALTER TABLE "gl_accounts" DROP COLUMN "reconciliation_required";
   ALTER TABLE "gl_accounts" DROP COLUMN "control_account";
   ALTER TABLE "gl_accounts" DROP COLUMN "posting_allowed";
   ALTER TABLE "gl_accounts" DROP COLUMN "financial_statement";
   ALTER TABLE "gl_accounts" DROP COLUMN "status";
 `)
}
