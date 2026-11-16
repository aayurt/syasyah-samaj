import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Slice A: gl_accounts hierarchy fields (level, parent_id, normal_balance)
   CREATE TYPE "public"."enum_gl_accounts_normal_balance" AS ENUM ('debit', 'credit');
   ALTER TABLE "gl_accounts" ADD COLUMN "parent_id" integer;
   ALTER TABLE "gl_accounts" ADD COLUMN "level" integer NOT NULL DEFAULT 0;
   ALTER TABLE "gl_accounts" ADD COLUMN "normal_balance" "public"."enum_gl_accounts_normal_balance" NOT NULL DEFAULT 'debit'::"public"."enum_gl_accounts_normal_balance";
   ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_parent_id_gl_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "gl_accounts_parent_idx" ON "gl_accounts" USING btree ("parent_id");
   CREATE INDEX "gl_accounts_level_idx" ON "gl_accounts" USING btree ("level");
   CREATE INDEX "gl_accounts_normal_balance_idx" ON "gl_accounts" USING btree ("normal_balance");

   -- Slice C: opening-balances workflow + audit fields
   CREATE TYPE "public"."enum_opening_balances_status" AS ENUM ('draft', 'approved', 'posted', 'reversed', 'rejected');
   ALTER TABLE "opening_balances" ADD COLUMN "status" "public"."enum_opening_balances_status" NOT NULL DEFAULT 'draft'::"public"."enum_opening_balances_status";
   ALTER TABLE "opening_balances" ADD COLUMN "posted_to_journal" boolean NOT NULL DEFAULT false;
   ALTER TABLE "opening_balances" ADD COLUMN "created_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "updated_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "approved_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "approved_at" timestamp(3) with time zone;
   ALTER TABLE "opening_balances" ADD COLUMN "posted_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "posted_at" timestamp(3) with time zone;
   ALTER TABLE "opening_balances" ADD COLUMN "reversed_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "reversed_at" timestamp(3) with time zone;
   ALTER TABLE "opening_balances" ADD COLUMN "reversal_reason" character varying;
   ALTER TABLE "opening_balances" ADD COLUMN "source_batch_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "rejected_by_id" integer;
   ALTER TABLE "opening_balances" ADD COLUMN "rejected_at" timestamp(3) with time zone;
   ALTER TABLE "opening_balances" ADD COLUMN "rejection_reason" character varying;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_reversed_by_id_users_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_source_batch_id_opening_balances_id_fk" FOREIGN KEY ("source_batch_id") REFERENCES "public"."opening_balances"("id") ON DELETE set null ON UPDATE no action;
   ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
   CREATE INDEX "opening_balances_status_idx" ON "opening_balances" USING btree ("status");
   CREATE INDEX "opening_balances_posted_to_journal_idx" ON "opening_balances" USING btree ("posted_to_journal");
   CREATE INDEX "opening_balances_source_batch_idx" ON "opening_balances" USING btree ("source_batch_id");
   CREATE INDEX "opening_balances_rejected_by_idx" ON "opening_balances" USING btree ("rejected_by_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_source_batch_id_opening_balances_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_rejected_by_id_users_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_reversed_by_id_users_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_posted_by_id_users_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_approved_by_id_users_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_updated_by_id_users_id_fk";
   ALTER TABLE "opening_balances" DROP CONSTRAINT "opening_balances_created_by_id_users_id_fk";
   DROP INDEX "opening_balances_source_batch_idx";
   DROP INDEX "opening_balances_rejected_by_idx";
   DROP INDEX "opening_balances_posted_to_journal_idx";
   DROP INDEX "opening_balances_status_idx";
   ALTER TABLE "opening_balances" DROP COLUMN "source_batch_id";
   ALTER TABLE "opening_balances" DROP COLUMN "rejected_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "rejected_at";
   ALTER TABLE "opening_balances" DROP COLUMN "rejection_reason";
   ALTER TABLE "opening_balances" DROP COLUMN "reversal_reason";
   ALTER TABLE "opening_balances" DROP COLUMN "reversed_at";
   ALTER TABLE "opening_balances" DROP COLUMN "reversed_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "posted_at";
   ALTER TABLE "opening_balances" DROP COLUMN "posted_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "approved_at";
   ALTER TABLE "opening_balances" DROP COLUMN "approved_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "updated_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "created_by_id";
   ALTER TABLE "opening_balances" DROP COLUMN "posted_to_journal";
   ALTER TABLE "opening_balances" DROP COLUMN "status";
   DROP TYPE "public"."enum_opening_balances_status";
   DROP INDEX "gl_accounts_normal_balance_idx";
   DROP INDEX "gl_accounts_level_idx";
   DROP INDEX "gl_accounts_parent_idx";
   ALTER TABLE "gl_accounts" DROP CONSTRAINT "gl_accounts_parent_id_gl_accounts_id_fk";
   ALTER TABLE "gl_accounts" DROP COLUMN "normal_balance";
   ALTER TABLE "gl_accounts" DROP COLUMN "level";
   ALTER TABLE "gl_accounts" DROP COLUMN "parent_id";
   DROP TYPE "public"."enum_gl_accounts_normal_balance";
  `)
}
