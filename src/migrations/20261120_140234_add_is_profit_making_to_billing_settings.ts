import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_gl_accounts_normal_balance" AS ENUM('debit', 'credit');
  CREATE TYPE "public"."enum_gl_accounts_status" AS ENUM('active', 'inactive', 'blocked', 'archived');
  CREATE TYPE "public"."enum_gl_accounts_financial_statement" AS ENUM('balance-sheet', 'income-statement');
  CREATE TYPE "public"."enum_opening_balances_status" AS ENUM('draft', 'approved', 'posted', 'reversed', 'rejected');
  CREATE TYPE "public"."enum_opening_balance_batches_status" AS ENUM('draft', 'approved', 'posted', 'rejected');
  CREATE TYPE "public"."enum_pay_groups_frequency" AS ENUM('MONTHLY', 'WEEKLY', 'FORTNIGHTLY', 'FOUR_WEEKLY');
  CREATE TYPE "public"."enum_payroll_runs_approval_status" AS ENUM('Draft', 'Submitted', 'Approved', 'Rejected');
  CREATE TYPE "public"."enum_payroll_settings_country" AS ENUM('Nepal', 'India');
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'sales-quote' BEFORE 'sales-invoice';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'sales-order' BEFORE 'sales-invoice';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'purchase-order' BEFORE 'purchase-invoice';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'contra' BEFORE 'contra-voucher';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'petty-cash-voucher' BEFORE 'grn';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'membership-receipt';
  ALTER TYPE "public"."enum_doc_sequences_doc_type" ADD VALUE 'donation-receipt';
  CREATE TABLE "opening_balance_batches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"status" "enum_opening_balance_batches_status" DEFAULT 'draft' NOT NULL,
  	"total_debit" numeric DEFAULT 0 NOT NULL,
  	"total_credit" numeric DEFAULT 0 NOT NULL,
  	"reference" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_balance_lines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"batch_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"debit" numeric DEFAULT 0 NOT NULL,
  	"credit" numeric DEFAULT 0 NOT NULL,
  	"currency_code" varchar DEFAULT 'NPR' NOT NULL,
  	"exchange_rate" numeric,
  	"base_currency_amount" numeric,
  	"branch" varchar,
  	"cost_centre" varchar,
  	"reference" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pay_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"frequency" "enum_pay_groups_frequency" DEFAULT 'MONTHLY' NOT NULL,
  	"periods_per_year" numeric DEFAULT 12,
  	"fiscal_year_id" integer NOT NULL,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "billing_settings_cogs_accounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"account_id" integer
  );
  
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-11-20T14:02:34.152Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-11-20T14:02:34.152Z';
  ALTER TABLE "account_groups" ADD COLUMN "level" numeric DEFAULT 0;
  ALTER TABLE "gl_accounts" ADD COLUMN "description" varchar;
  ALTER TABLE "gl_accounts" ADD COLUMN "parent_id" integer;
  ALTER TABLE "gl_accounts" ADD COLUMN "level" numeric DEFAULT 0;
  ALTER TABLE "gl_accounts" ADD COLUMN "normal_balance" "enum_gl_accounts_normal_balance" DEFAULT 'debit';
  ALTER TABLE "gl_accounts" ADD COLUMN "status" "enum_gl_accounts_status" DEFAULT 'active' NOT NULL;
  ALTER TABLE "gl_accounts" ADD COLUMN "financial_statement" "enum_gl_accounts_financial_statement";
  ALTER TABLE "gl_accounts" ADD COLUMN "posting_allowed" boolean DEFAULT true;
  ALTER TABLE "gl_accounts" ADD COLUMN "control_account" boolean DEFAULT false;
  ALTER TABLE "gl_accounts" ADD COLUMN "reconciliation_required" boolean DEFAULT false;
  ALTER TABLE "gl_accounts" ADD COLUMN "cost_centre_required" boolean DEFAULT false;
  ALTER TABLE "gl_accounts" ADD COLUMN "branch_required" boolean DEFAULT false;
  ALTER TABLE "gl_accounts" ADD COLUMN "currency_code" varchar DEFAULT 'NPR';
  ALTER TABLE "gl_accounts" ADD COLUMN "effective_from" timestamp(3) with time zone;
  ALTER TABLE "gl_accounts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "employees" ADD COLUMN "bank_name" varchar;
  ALTER TABLE "employees" ADD COLUMN "bank_account_number" varchar;
  ALTER TABLE "employees" ADD COLUMN "annual_salary" numeric DEFAULT 0;
  ALTER TABLE "employees" ADD COLUMN "joining_date" timestamp(3) with time zone;
  ALTER TABLE "employees" ADD COLUMN "termination_date" timestamp(3) with time zone;
  ALTER TABLE "opening_balances" ADD COLUMN "posted_to_journal" boolean DEFAULT false;
  ALTER TABLE "opening_balances" ADD COLUMN "status" "enum_opening_balances_status" DEFAULT 'draft' NOT NULL;
  ALTER TABLE "opening_balances" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "approved_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "approved_at" timestamp(3) with time zone;
  ALTER TABLE "opening_balances" ADD COLUMN "posted_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "posted_at" timestamp(3) with time zone;
  ALTER TABLE "opening_balances" ADD COLUMN "reversed_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "reversed_at" timestamp(3) with time zone;
  ALTER TABLE "opening_balances" ADD COLUMN "rejected_by_id" integer;
  ALTER TABLE "opening_balances" ADD COLUMN "rejected_at" timestamp(3) with time zone;
  ALTER TABLE "opening_balances" ADD COLUMN "rejection_reason" varchar;
  ALTER TABLE "opening_balances" ADD COLUMN "reversal_reason" varchar;
  ALTER TABLE "opening_balances" ADD COLUMN "source_batch_id" integer;
  ALTER TABLE "payroll_runs" ADD COLUMN "batch_number" varchar NOT NULL;
  ALTER TABLE "payroll_runs" ADD COLUMN "approval_status" "enum_payroll_runs_approval_status" DEFAULT 'Draft';
  ALTER TABLE "payroll_runs" ADD COLUMN "variance_review" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "opening_balance_batches_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "opening_balance_lines_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pay_groups_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "payroll_enabled" boolean DEFAULT true;
  ALTER TABLE "billing_settings" ADD COLUMN "is_profit_making" boolean DEFAULT true;
  ALTER TABLE "billing_settings" ADD COLUMN "inter_illaka_clearing_account_id" integer;
  ALTER TABLE "payroll_settings" ADD COLUMN "country" "enum_payroll_settings_country" DEFAULT 'Nepal';
  ALTER TABLE "payroll_settings" ADD COLUMN "ssf_enabled" boolean DEFAULT true;
  ALTER TABLE "payroll_settings" ADD COLUMN "pf_enabled" boolean DEFAULT true;
  ALTER TABLE "payroll_settings" ADD COLUMN "cit_enabled" boolean DEFAULT true;
  ALTER TABLE "payroll_settings" ADD COLUMN "ssf_rate" numeric DEFAULT 11;
  ALTER TABLE "payroll_settings" ADD COLUMN "pf_rate" numeric DEFAULT 10;
  ALTER TABLE "payroll_settings" ADD COLUMN "ssf_min_basic" numeric DEFAULT 7000;
  ALTER TABLE "payroll_settings" ADD COLUMN "ssf_number" varchar;
  ALTER TABLE "payroll_settings" ADD COLUMN "pan_number" varchar;
  ALTER TABLE "payroll_settings" ADD COLUMN "ssf_payable_account_id" integer;
  ALTER TABLE "payroll_settings" ADD COLUMN "pf_payable_account_id" integer;
  ALTER TABLE "payroll_settings" ADD COLUMN "cit_payable_account_id" integer;
  ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balance_batches" ADD CONSTRAINT "opening_balance_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_batch_id_opening_balance_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."opening_balance_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balance_lines" ADD CONSTRAINT "opening_balance_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pay_groups" ADD CONSTRAINT "pay_groups_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pay_groups" ADD CONSTRAINT "pay_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings_cogs_accounts" ADD CONSTRAINT "billing_settings_cogs_accounts_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings_cogs_accounts" ADD CONSTRAINT "billing_settings_cogs_accounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."billing_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "opening_balance_batches_fiscal_year_idx" ON "opening_balance_batches" USING btree ("fiscal_year_id");
  CREATE INDEX "opening_balance_batches_tenant_idx" ON "opening_balance_batches" USING btree ("tenant_id");
  CREATE INDEX "opening_balance_batches_updated_at_idx" ON "opening_balance_batches" USING btree ("updated_at");
  CREATE INDEX "opening_balance_batches_created_at_idx" ON "opening_balance_batches" USING btree ("created_at");
  CREATE INDEX "opening_balance_lines_batch_idx" ON "opening_balance_lines" USING btree ("batch_id");
  CREATE INDEX "opening_balance_lines_account_idx" ON "opening_balance_lines" USING btree ("account_id");
  CREATE INDEX "opening_balance_lines_updated_at_idx" ON "opening_balance_lines" USING btree ("updated_at");
  CREATE INDEX "opening_balance_lines_created_at_idx" ON "opening_balance_lines" USING btree ("created_at");
  CREATE INDEX "pay_groups_fiscal_year_idx" ON "pay_groups" USING btree ("fiscal_year_id");
  CREATE INDEX "pay_groups_tenant_idx" ON "pay_groups" USING btree ("tenant_id");
  CREATE INDEX "pay_groups_updated_at_idx" ON "pay_groups" USING btree ("updated_at");
  CREATE INDEX "pay_groups_created_at_idx" ON "pay_groups" USING btree ("created_at");
  CREATE INDEX "billing_settings_cogs_accounts_order_idx" ON "billing_settings_cogs_accounts" USING btree ("_order");
  CREATE INDEX "billing_settings_cogs_accounts_parent_id_idx" ON "billing_settings_cogs_accounts" USING btree ("_parent_id");
  CREATE INDEX "billing_settings_cogs_accounts_account_idx" ON "billing_settings_cogs_accounts" USING btree ("account_id");
  ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_parent_id_gl_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_reversed_by_id_users_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_source_batch_id_opening_balances_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."opening_balances"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_balance_batches_fk" FOREIGN KEY ("opening_balance_batches_id") REFERENCES "public"."opening_balance_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_balance_lines_fk" FOREIGN KEY ("opening_balance_lines_id") REFERENCES "public"."opening_balance_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pay_groups_fk" FOREIGN KEY ("pay_groups_id") REFERENCES "public"."pay_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_inter_illaka_clearing_account_id_gl_accounts_id_fk" FOREIGN KEY ("inter_illaka_clearing_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_ssf_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("ssf_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_pf_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("pf_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_cit_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("cit_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "gl_accounts_parent_idx" ON "gl_accounts" USING btree ("parent_id");
  CREATE INDEX "opening_balances_created_by_idx" ON "opening_balances" USING btree ("created_by_id");
  CREATE INDEX "opening_balances_updated_by_idx" ON "opening_balances" USING btree ("updated_by_id");
  CREATE INDEX "opening_balances_approved_by_idx" ON "opening_balances" USING btree ("approved_by_id");
  CREATE INDEX "opening_balances_posted_by_idx" ON "opening_balances" USING btree ("posted_by_id");
  CREATE INDEX "opening_balances_reversed_by_idx" ON "opening_balances" USING btree ("reversed_by_id");
  CREATE INDEX "opening_balances_rejected_by_idx" ON "opening_balances" USING btree ("rejected_by_id");
  CREATE INDEX "opening_balances_source_batch_idx" ON "opening_balances" USING btree ("source_batch_id");
  CREATE INDEX "payload_locked_documents_rels_opening_balance_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_balance_batches_id");
  CREATE INDEX "payload_locked_documents_rels_opening_balance_lines_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_balance_lines_id");
  CREATE INDEX "payload_locked_documents_rels_pay_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("pay_groups_id");
  CREATE INDEX "billing_settings_inter_illaka_clearing_account_idx" ON "billing_settings" USING btree ("inter_illaka_clearing_account_id");
  CREATE INDEX "payroll_settings_ssf_payable_account_idx" ON "payroll_settings" USING btree ("ssf_payable_account_id");
  CREATE INDEX "payroll_settings_pf_payable_account_idx" ON "payroll_settings" USING btree ("pf_payable_account_id");
  CREATE INDEX "payroll_settings_cit_payable_account_idx" ON "payroll_settings" USING btree ("cit_payable_account_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "opening_balance_batches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "opening_balance_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pay_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "billing_settings_cogs_accounts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "opening_balance_batches" CASCADE;
  DROP TABLE "opening_balance_lines" CASCADE;
  DROP TABLE "pay_groups" CASCADE;
  DROP TABLE "billing_settings_cogs_accounts" CASCADE;
  ALTER TABLE "gl_accounts" DROP CONSTRAINT "gl_accounts_parent_id_gl_accounts_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_created_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_updated_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_approved_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_posted_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_reversed_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_rejected_by_id_users_id_fk";
  
  ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_source_batch_id_opening_balances_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_opening_balance_batches_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_opening_balance_lines_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pay_groups_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_inter_illaka_clearing_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "payroll_settings" DROP CONSTRAINT "payroll_settings_ssf_payable_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "payroll_settings" DROP CONSTRAINT "payroll_settings_pf_payable_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "payroll_settings" DROP CONSTRAINT "payroll_settings_cit_payable_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "doc_sequences" ALTER COLUMN "doc_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_doc_sequences_doc_type";
  CREATE TYPE "public"."enum_doc_sequences_doc_type" AS ENUM('sales-invoice', 'purchase-invoice', 'receipt-voucher', 'payment-voucher', 'journal-voucher', 'contra-voucher', 'credit-note', 'debit-note', 'grn', 'delivery-challan');
  ALTER TABLE "doc_sequences" ALTER COLUMN "doc_type" SET DATA TYPE "public"."enum_doc_sequences_doc_type" USING "doc_type"::"public"."enum_doc_sequences_doc_type";
  DROP INDEX "gl_accounts_parent_idx";
  DROP INDEX "opening_balances_created_by_idx";
  DROP INDEX "opening_balances_updated_by_idx";
  DROP INDEX "opening_balances_approved_by_idx";
  DROP INDEX "opening_balances_posted_by_idx";
  DROP INDEX "opening_balances_reversed_by_idx";
  DROP INDEX "opening_balances_rejected_by_idx";
  DROP INDEX "opening_balances_source_batch_idx";
  DROP INDEX "payload_locked_documents_rels_opening_balance_batches_id_idx";
  DROP INDEX "payload_locked_documents_rels_opening_balance_lines_id_idx";
  DROP INDEX "payload_locked_documents_rels_pay_groups_id_idx";
  DROP INDEX "billing_settings_inter_illaka_clearing_account_idx";
  DROP INDEX "payroll_settings_ssf_payable_account_idx";
  DROP INDEX "payroll_settings_pf_payable_account_idx";
  DROP INDEX "payroll_settings_cit_payable_account_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-10-11T04:54:10.154Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-10-11T04:54:10.154Z';
  ALTER TABLE "account_groups" DROP COLUMN "level";
  ALTER TABLE "gl_accounts" DROP COLUMN "description";
  ALTER TABLE "gl_accounts" DROP COLUMN "parent_id";
  ALTER TABLE "gl_accounts" DROP COLUMN "level";
  ALTER TABLE "gl_accounts" DROP COLUMN "normal_balance";
  ALTER TABLE "gl_accounts" DROP COLUMN "status";
  ALTER TABLE "gl_accounts" DROP COLUMN "financial_statement";
  ALTER TABLE "gl_accounts" DROP COLUMN "posting_allowed";
  ALTER TABLE "gl_accounts" DROP COLUMN "control_account";
  ALTER TABLE "gl_accounts" DROP COLUMN "reconciliation_required";
  ALTER TABLE "gl_accounts" DROP COLUMN "cost_centre_required";
  ALTER TABLE "gl_accounts" DROP COLUMN "branch_required";
  ALTER TABLE "gl_accounts" DROP COLUMN "currency_code";
  ALTER TABLE "gl_accounts" DROP COLUMN "effective_from";
  ALTER TABLE "gl_accounts" DROP COLUMN "deleted_at";
  ALTER TABLE "employees" DROP COLUMN "bank_name";
  ALTER TABLE "employees" DROP COLUMN "bank_account_number";
  ALTER TABLE "employees" DROP COLUMN "annual_salary";
  ALTER TABLE "employees" DROP COLUMN "joining_date";
  ALTER TABLE "employees" DROP COLUMN "termination_date";
  ALTER TABLE "opening_balances" DROP COLUMN "posted_to_journal";
  ALTER TABLE "opening_balances" DROP COLUMN "status";
  ALTER TABLE "opening_balances" DROP COLUMN "created_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "updated_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "approved_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "approved_at";
  ALTER TABLE "opening_balances" DROP COLUMN "posted_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "posted_at";
  ALTER TABLE "opening_balances" DROP COLUMN "reversed_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "reversed_at";
  ALTER TABLE "opening_balances" DROP COLUMN "rejected_by_id";
  ALTER TABLE "opening_balances" DROP COLUMN "rejected_at";
  ALTER TABLE "opening_balances" DROP COLUMN "rejection_reason";
  ALTER TABLE "opening_balances" DROP COLUMN "reversal_reason";
  ALTER TABLE "opening_balances" DROP COLUMN "source_batch_id";
  ALTER TABLE "payroll_runs" DROP COLUMN "batch_number";
  ALTER TABLE "payroll_runs" DROP COLUMN "approval_status";
  ALTER TABLE "payroll_runs" DROP COLUMN "variance_review";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "opening_balance_batches_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "opening_balance_lines_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pay_groups_id";
  ALTER TABLE "billing_settings" DROP COLUMN "payroll_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "is_profit_making";
  ALTER TABLE "billing_settings" DROP COLUMN "inter_illaka_clearing_account_id";
  ALTER TABLE "payroll_settings" DROP COLUMN "country";
  ALTER TABLE "payroll_settings" DROP COLUMN "ssf_enabled";
  ALTER TABLE "payroll_settings" DROP COLUMN "pf_enabled";
  ALTER TABLE "payroll_settings" DROP COLUMN "cit_enabled";
  ALTER TABLE "payroll_settings" DROP COLUMN "ssf_rate";
  ALTER TABLE "payroll_settings" DROP COLUMN "pf_rate";
  ALTER TABLE "payroll_settings" DROP COLUMN "ssf_min_basic";
  ALTER TABLE "payroll_settings" DROP COLUMN "ssf_number";
  ALTER TABLE "payroll_settings" DROP COLUMN "pan_number";
  ALTER TABLE "payroll_settings" DROP COLUMN "ssf_payable_account_id";
  ALTER TABLE "payroll_settings" DROP COLUMN "pf_payable_account_id";
  ALTER TABLE "payroll_settings" DROP COLUMN "cit_payable_account_id";
  DROP TYPE "public"."enum_gl_accounts_normal_balance";
  DROP TYPE "public"."enum_gl_accounts_status";
  DROP TYPE "public"."enum_gl_accounts_financial_statement";
  DROP TYPE "public"."enum_opening_balances_status";
  DROP TYPE "public"."enum_opening_balance_batches_status";
  DROP TYPE "public"."enum_pay_groups_frequency";
  DROP TYPE "public"."enum_payroll_runs_approval_status";
  DROP TYPE "public"."enum_payroll_settings_country";`)
}
