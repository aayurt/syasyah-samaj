import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_items_valuation_method" AS ENUM('avco', 'fifo');
  CREATE TABLE "items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"unit" varchar,
  	"valuation_method" "enum_items_valuation_method" DEFAULT 'avco' NOT NULL,
  	"reorder_level" numeric DEFAULT 0,
  	"opening_stock" numeric DEFAULT 0,
  	"sale_price" numeric,
  	"purchase_price" numeric,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_movements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"doc_id" integer,
  	"date" timestamp(3) with time zone NOT NULL,
  	"qty_in" numeric,
  	"qty_out" numeric,
  	"unit_cost" numeric,
  	"location" varchar,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T15:48:14.942Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T15:48:14.942Z';
  ALTER TABLE "documents_lines" ADD COLUMN "item_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_movements_id" integer;
  ALTER TABLE "items" ADD CONSTRAINT "items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "items_tenant_idx" ON "items" USING btree ("tenant_id");
  CREATE INDEX "items_updated_at_idx" ON "items" USING btree ("updated_at");
  CREATE INDEX "items_created_at_idx" ON "items" USING btree ("created_at");
  CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("item_id");
  CREATE INDEX "stock_movements_doc_idx" ON "stock_movements" USING btree ("doc_id");
  CREATE INDEX "stock_movements_tenant_idx" ON "stock_movements" USING btree ("tenant_id");
  CREATE INDEX "stock_movements_updated_at_idx" ON "stock_movements" USING btree ("updated_at");
  CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");
  ALTER TABLE "documents_lines" ADD CONSTRAINT "documents_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_items_fk" FOREIGN KEY ("items_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_movements_fk" FOREIGN KEY ("stock_movements_id") REFERENCES "public"."stock_movements"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "documents_lines_item_idx" ON "documents_lines" USING btree ("item_id");
  CREATE INDEX "payload_locked_documents_rels_items_id_idx" ON "payload_locked_documents_rels" USING btree ("items_id");
  CREATE INDEX "payload_locked_documents_rels_stock_movements_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_movements_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_movements" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "items" CASCADE;
  DROP TABLE "stock_movements" CASCADE;
  ALTER TABLE "documents_lines" DROP CONSTRAINT "documents_lines_item_id_items_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_items_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_movements_fk";
  
  DROP INDEX "documents_lines_item_idx";
  DROP INDEX "payload_locked_documents_rels_items_id_idx";
  DROP INDEX "payload_locked_documents_rels_stock_movements_id_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T12:22:05.765Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T12:22:05.765Z';
  ALTER TABLE "documents_lines" DROP COLUMN "item_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_movements_id";
  DROP TYPE "public"."enum_items_valuation_method";`)
}
