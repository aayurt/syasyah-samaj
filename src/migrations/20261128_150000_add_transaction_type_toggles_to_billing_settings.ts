import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "receipt_voucher_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "payment_voucher_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "journal_voucher_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "contra_voucher_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "sales_invoice_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "purchase_invoice_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "credit_note_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "debit_note_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "grn_enabled" boolean DEFAULT true;
    ALTER TABLE "billing_settings" ADD COLUMN IF NOT EXISTS "delivery_challan_enabled" boolean DEFAULT true;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "receipt_voucher_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "payment_voucher_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "journal_voucher_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "contra_voucher_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "sales_invoice_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "purchase_invoice_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "credit_note_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "debit_note_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "grn_enabled";
    ALTER TABLE "billing_settings" DROP COLUMN IF EXISTS "delivery_challan_enabled";
  `)
}