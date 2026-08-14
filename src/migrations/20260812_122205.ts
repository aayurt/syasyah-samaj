import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_parties_type" AS ENUM('customer', 'vendor', 'both');
  CREATE TYPE "public"."enum_documents_doc_type" AS ENUM('sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher', 'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan', 'journal-voucher');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('draft', 'posted', 'void');
  CREATE TYPE "public"."enum_documents_payment_method" AS ENUM('cash', 'bank');
  CREATE TABLE "parties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_parties_type" DEFAULT 'customer' NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"tax_id" varchar,
  	"address" varchar,
  	"opening_balance" numeric DEFAULT 0,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar,
  	"qty" numeric,
  	"rate" numeric,
  	"amount" numeric
  );
  
  CREATE TABLE "documents_journal_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"account_id" integer,
  	"debit" numeric,
  	"credit" numeric,
  	"memo" varchar
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"doc_type" "enum_documents_doc_type" NOT NULL,
  	"number" varchar,
  	"date" timestamp(3) with time zone NOT NULL,
  	"party_id" integer,
  	"narration" varchar,
  	"status" "enum_documents_status" DEFAULT 'draft' NOT NULL,
  	"posted_at" timestamp(3) with time zone,
  	"journal_entry_id" integer,
  	"reference_to_id" integer,
  	"payment_method" "enum_documents_payment_method",
  	"bank_account_id" integer,
  	"tax_rate" numeric DEFAULT 0,
  	"net_total" numeric,
  	"tax_total" numeric,
  	"gross_total" numeric,
  	"created_by_id" integer,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "doc_sequences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"last_number" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "billing_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"fiscal_year_start" timestamp(3) with time zone,
  	"receivable_account_id" integer,
  	"payable_account_id" integer,
  	"revenue_account_id" integer,
  	"expense_account_id" integer,
  	"tax_account_id" integer,
  	"cash_account_id" integer,
  	"bank_account_id" integer,
  	"petty_cash_account_id" integer,
  	"inventory_account_id" integer,
  	"cogs_account_id" integer,
  	"returns_account_id" integer,
  	"accrued_payable_account_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T12:22:05.765Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T12:22:05.765Z';
  ALTER TABLE "journal_entries" ADD COLUMN "reference_doc_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "parties_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doc_sequences_id" integer;
  ALTER TABLE "parties" ADD CONSTRAINT "parties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_lines" ADD CONSTRAINT "documents_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_journal_lines" ADD CONSTRAINT "documents_journal_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_journal_lines" ADD CONSTRAINT "documents_journal_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_reference_to_id_documents_id_fk" FOREIGN KEY ("reference_to_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_bank_account_id_gl_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_receivable_account_id_gl_accounts_id_fk" FOREIGN KEY ("receivable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_revenue_account_id_gl_accounts_id_fk" FOREIGN KEY ("revenue_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_expense_account_id_gl_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_tax_account_id_gl_accounts_id_fk" FOREIGN KEY ("tax_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_cash_account_id_gl_accounts_id_fk" FOREIGN KEY ("cash_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_bank_account_id_gl_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_petty_cash_account_id_gl_accounts_id_fk" FOREIGN KEY ("petty_cash_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_inventory_account_id_gl_accounts_id_fk" FOREIGN KEY ("inventory_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_cogs_account_id_gl_accounts_id_fk" FOREIGN KEY ("cogs_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_returns_account_id_gl_accounts_id_fk" FOREIGN KEY ("returns_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_accrued_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("accrued_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "parties_tenant_idx" ON "parties" USING btree ("tenant_id");
  CREATE INDEX "parties_updated_at_idx" ON "parties" USING btree ("updated_at");
  CREATE INDEX "parties_created_at_idx" ON "parties" USING btree ("created_at");
  CREATE INDEX "documents_lines_order_idx" ON "documents_lines" USING btree ("_order");
  CREATE INDEX "documents_lines_parent_id_idx" ON "documents_lines" USING btree ("_parent_id");
  CREATE INDEX "documents_journal_lines_order_idx" ON "documents_journal_lines" USING btree ("_order");
  CREATE INDEX "documents_journal_lines_parent_id_idx" ON "documents_journal_lines" USING btree ("_parent_id");
  CREATE INDEX "documents_journal_lines_account_idx" ON "documents_journal_lines" USING btree ("account_id");
  CREATE INDEX "documents_party_idx" ON "documents" USING btree ("party_id");
  CREATE INDEX "documents_journal_entry_idx" ON "documents" USING btree ("journal_entry_id");
  CREATE INDEX "documents_reference_to_idx" ON "documents" USING btree ("reference_to_id");
  CREATE INDEX "documents_bank_account_idx" ON "documents" USING btree ("bank_account_id");
  CREATE INDEX "documents_created_by_idx" ON "documents" USING btree ("created_by_id");
  CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "doc_sequences_key_idx" ON "doc_sequences" USING btree ("key");
  CREATE INDEX "doc_sequences_updated_at_idx" ON "doc_sequences" USING btree ("updated_at");
  CREATE INDEX "doc_sequences_created_at_idx" ON "doc_sequences" USING btree ("created_at");
  CREATE INDEX "billing_settings_receivable_account_idx" ON "billing_settings" USING btree ("receivable_account_id");
  CREATE INDEX "billing_settings_payable_account_idx" ON "billing_settings" USING btree ("payable_account_id");
  CREATE INDEX "billing_settings_revenue_account_idx" ON "billing_settings" USING btree ("revenue_account_id");
  CREATE INDEX "billing_settings_expense_account_idx" ON "billing_settings" USING btree ("expense_account_id");
  CREATE INDEX "billing_settings_tax_account_idx" ON "billing_settings" USING btree ("tax_account_id");
  CREATE INDEX "billing_settings_cash_account_idx" ON "billing_settings" USING btree ("cash_account_id");
  CREATE INDEX "billing_settings_bank_account_idx" ON "billing_settings" USING btree ("bank_account_id");
  CREATE INDEX "billing_settings_petty_cash_account_idx" ON "billing_settings" USING btree ("petty_cash_account_id");
  CREATE INDEX "billing_settings_inventory_account_idx" ON "billing_settings" USING btree ("inventory_account_id");
  CREATE INDEX "billing_settings_cogs_account_idx" ON "billing_settings" USING btree ("cogs_account_id");
  CREATE INDEX "billing_settings_returns_account_idx" ON "billing_settings" USING btree ("returns_account_id");
  CREATE INDEX "billing_settings_accrued_payable_account_idx" ON "billing_settings" USING btree ("accrued_payable_account_id");
  ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reference_doc_id_documents_id_fk" FOREIGN KEY ("reference_doc_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parties_fk" FOREIGN KEY ("parties_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doc_sequences_fk" FOREIGN KEY ("doc_sequences_id") REFERENCES "public"."doc_sequences"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "journal_entries_reference_doc_idx" ON "journal_entries" USING btree ("reference_doc_id");
  CREATE INDEX "payload_locked_documents_rels_parties_id_idx" ON "payload_locked_documents_rels" USING btree ("parties_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_doc_sequences_id_idx" ON "payload_locked_documents_rels" USING btree ("doc_sequences_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_journal_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "doc_sequences" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "billing_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "parties" CASCADE;
  DROP TABLE "documents_lines" CASCADE;
  DROP TABLE "documents_journal_lines" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "doc_sequences" CASCADE;
  DROP TABLE "billing_settings" CASCADE;
  ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_reference_doc_id_documents_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_parties_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_doc_sequences_fk";
  
  DROP INDEX "journal_entries_reference_doc_idx";
  DROP INDEX "payload_locked_documents_rels_parties_id_idx";
  DROP INDEX "payload_locked_documents_rels_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_doc_sequences_id_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T11:18:05.410Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T11:18:05.410Z';
  ALTER TABLE "journal_entries" DROP COLUMN "reference_doc_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "parties_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "doc_sequences_id";
  DROP TYPE "public"."enum_parties_type";
  DROP TYPE "public"."enum_documents_doc_type";
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum_documents_payment_method";`)
}
