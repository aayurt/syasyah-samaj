import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 3 — Opening balance batches & lines (spec §7, §8).
 *
 * Additive: existing `opening_balances` (signed amount) is left untouched.
 * New tables provide explicit debit/credit numeric columns per line, grouped
 * into batches, per spec. Monetary columns use numeric (never float).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_opening_balance_batch_status" AS ENUM ('draft', 'approved', 'posted', 'rejected');

   CREATE TABLE "opening_balance_batches" (
     "id" serial PRIMARY KEY,
     "fiscal_year_id" integer,
     "tenant_id" integer,
     "status" "public"."enum_opening_balance_batch_status" NOT NULL DEFAULT 'draft',
     "total_debit" numeric(14,2) NOT NULL DEFAULT 0,
     "total_credit" numeric(14,2) NOT NULL DEFAULT 0,
     "reference" character varying,
     "created_by_id" integer,
     "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
     "approved_by_id" integer,
     "approved_at" timestamp(3) with time zone,
     "posted_by_id" integer,
     "posted_at" timestamp(3) with time zone,
     "rejected_by_id" integer,
     "rejected_at" timestamp(3) with time zone,
     "rejection_reason" character varying,
     "updated_by_id" integer,
     "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
   );

   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "opening_balance_batches_status_idx" ON "opening_balance_batches" USING btree ("status");
   CREATE INDEX "opening_balance_batches_tenant_idx" ON "opening_balance_batches" USING btree ("tenant_id");

   CREATE TABLE "opening_balance_lines" (
     "id" serial PRIMARY KEY,
     "batch_id" integer NOT NULL,
     "account_id" integer NOT NULL,
     "debit" numeric(14,2) NOT NULL DEFAULT 0,
     "credit" numeric(14,2) NOT NULL DEFAULT 0,
     "currency_code" character varying NOT NULL DEFAULT 'NPR',
     "exchange_rate" numeric(10,6),
     "base_currency_amount" numeric(14,2),
     "branch" character varying,
     "cost_centre" character varying,
     "reference" character varying,
     "description" text,
     "created_by_id" integer,
     "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
     "updated_by_id" integer,
     "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
   );

   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_batch_id_opening_balance_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."opening_balance_batches"("id") ON DELETE cascade ON UPDATE no action;
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   -- Check: amounts non-negative and not both positive on one line.
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_debit_nonneg_check" CHECK ("debit" >= 0);
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_credit_nonneg_check" CHECK ("credit" >= 0);
   ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_not_both_positive_check" CHECK (NOT ("debit" > 0 AND "credit" > 0));
   CREATE INDEX "opening_balance_lines_batch_idx" ON "opening_balance_lines" USING btree ("batch_id");
   CREATE INDEX "opening_balance_lines_account_idx" ON "opening_balance_lines" USING btree ("account_id");
 `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_not_both_positive_check";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_credit_nonneg_check";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_debit_nonneg_check";
   DROP INDEX "opening_balance_lines_account_idx";
   DROP INDEX "opening_balance_lines_batch_idx";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_updated_by_id_users_id_fk";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_created_by_id_users_id_fk";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_account_id_gl_accounts_id_fk";
   ALTER TABLE "opening_balance_lines" DROP CONSTRAINT "opening_balance_lines_batch_id_opening_balance_batches_id_fk";
   DROP TABLE "opening_balance_lines";
   DROP INDEX "opening_balance_batches_tenant_idx";
   DROP INDEX "opening_balance_batches_status_idx";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_updated_by_id_users_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_rejected_by_id_users_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_posted_by_id_users_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_approved_by_id_users_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_created_by_id_users_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_tenant_id_tenants_id_fk";
   ALTER TABLE "opening_balance_batches" DROP CONSTRAINT "opening_balance_batches_fiscal_year_id_fiscal_years_id_fk";
   DROP TABLE "opening_balance_batches";
   DROP TYPE "public"."enum_opening_balance_batch_status";
 `)
}
