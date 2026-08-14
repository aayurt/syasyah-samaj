import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'ne', 'new');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'ne', 'new');
  CREATE TYPE "public"."enum__posts_v_published_locale" AS ENUM('en', 'ne', 'new');
  CREATE TYPE "public"."enum_users_gender" AS ENUM('male', 'female', 'other', 'prefer-not-to-say');
  CREATE TYPE "public"."enum_events_tags" AS ENUM('music', 'gaming', 'theatre', 'arts', 'business', 'technology', 'sports', 'food-drink', 'exhibition', 'comedy', 'workshop', 'fitness');
  CREATE TYPE "public"."enum_account_groups_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');
  CREATE TYPE "public"."enum_gl_accounts_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');
  CREATE TYPE "public"."enum_gl_accounts_class" AS ENUM('cash', 'bank', 'other');
  CREATE TYPE "public"."enum_journal_entries_status" AS ENUM('draft', 'posted', 'void');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('info', 'event', 'reminder', 'system');
  CREATE TYPE "public"."enum_members_role" AS ENUM('admin', 'moderator', 'member', 'vip');
  CREATE TYPE "public"."enum_members_status" AS ENUM('active', 'inactive', 'suspended');
  CREATE TYPE "public"."enum_chat_rooms_type" AS ENUM('direct', 'group');
  CREATE TABLE "pages_locales" (
  	"title" varchar,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_title" varchar,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "posts_locales" (
  	"title" varchar,
  	"content" jsonb,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_posts_v_locales" (
  	"version_title" varchar,
  	"version_content" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "users_fcm_tokens" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"token" varchar NOT NULL,
  	"device" varchar
  );
  
  CREATE TABLE "events_tags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_events_tags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "events_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"content" jsonb NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "events_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"events_id" integer
  );
  
  CREATE TABLE "account_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"type" "enum_account_groups_type" NOT NULL,
  	"parent_id" integer,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "gl_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"group_id" integer,
  	"type" "enum_gl_accounts_type" NOT NULL,
  	"class" "enum_gl_accounts_class" DEFAULT 'other',
  	"opening_balance" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"allow_manual_posting" boolean DEFAULT true,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "journal_entries_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"debit" numeric,
  	"credit" numeric,
  	"memo" varchar
  );
  
  CREATE TABLE "journal_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"narration" varchar,
  	"status" "enum_journal_entries_status" DEFAULT 'draft' NOT NULL,
  	"posted_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tenants_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "tenants_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"type" "enum_notifications_type" DEFAULT 'info',
  	"read" boolean DEFAULT false,
  	"link" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "favorites" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"event_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"full_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"profile_image_id" integer,
  	"bio" varchar,
  	"role" "enum_members_role" DEFAULT 'member',
  	"social_links_twitter" varchar,
  	"social_links_linkedin" varchar,
  	"social_links_website" varchar,
  	"status" "enum_members_status" DEFAULT 'active',
  	"joined_date" timestamp(3) with time zone,
  	"phone_number" varchar,
  	"member_id" varchar,
  	"user_id" integer,
  	"expiry_date" timestamp(3) with time zone,
  	"id_card_details_blood_group" varchar,
  	"id_card_details_emergency_contact" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "archives" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"year" numeric,
  	"hero_image_id" integer,
  	"slug" varchar,
  	"slug_lock" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "archives_locales" (
  	"title" varchar NOT NULL,
  	"era" varchar,
  	"content" jsonb NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"chat_room_id" integer NOT NULL,
  	"sender_id" integer NOT NULL,
  	"content" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "messages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "chat_rooms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"type" "enum_chat_rooms_type" DEFAULT 'direct' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "chat_rooms_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "forms_blocks_checkbox_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_country_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_email_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_message_locales" (
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_number_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_state_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_text_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_textarea_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_emails_locales" (
  	"subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL,
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_locales" (
  	"submit_button_label" varchar,
  	"confirmation_message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "search_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT "posts_meta_image_id_media_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk";
  
  DROP INDEX "pages_meta_meta_image_idx";
  DROP INDEX "_pages_v_version_meta_version_meta_image_idx";
  DROP INDEX "posts_meta_meta_image_idx";
  DROP INDEX "_posts_v_version_meta_version_meta_image_idx";
  DROP INDEX "media_sizes_square_sizes_square_filename_idx";
  DROP INDEX "media_sizes_medium_sizes_medium_filename_idx";
  DROP INDEX "media_sizes_xlarge_sizes_xlarge_filename_idx";
  DROP INDEX "media_sizes_og_sizes_og_filename_idx";
  DROP INDEX "pages_rels_pages_id_idx";
  DROP INDEX "pages_rels_posts_id_idx";
  DROP INDEX "pages_rels_categories_id_idx";
  DROP INDEX "_pages_v_rels_pages_id_idx";
  DROP INDEX "_pages_v_rels_posts_id_idx";
  DROP INDEX "_pages_v_rels_categories_id_idx";
  DROP INDEX "header_rels_pages_id_idx";
  DROP INDEX "header_rels_posts_id_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T11:18:05.410Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T11:18:05.410Z';
  ALTER TABLE "pages_blocks_cta_links" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_cta" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_content" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_media_block" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_archive" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_blocks_form_block" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "pages_rels" ADD COLUMN "locale" "_locales";
  ALTER TABLE "_pages_v_blocks_cta_links" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_cta" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_content" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_media_block" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_archive" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v_blocks_form_block" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "_pages_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "published_locale" "enum__pages_v_published_locale";
  ALTER TABLE "_pages_v_rels" ADD COLUMN "locale" "_locales";
  ALTER TABLE "_posts_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_posts_v" ADD COLUMN "published_locale" "enum__posts_v_published_locale";
  ALTER TABLE "categories_breadcrumbs" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "users" ADD COLUMN "image_id" integer;
  ALTER TABLE "users" ADD COLUMN "phone_number" varchar;
  ALTER TABLE "users" ADD COLUMN "gender" "enum_users_gender" DEFAULT 'prefer-not-to-say';
  ALTER TABLE "users" ADD COLUMN "enable_a_p_i_key" boolean;
  ALTER TABLE "users" ADD COLUMN "api_key" varchar;
  ALTER TABLE "users" ADD COLUMN "api_key_index" varchar;
  ALTER TABLE "events" ADD COLUMN "slug" varchar;
  ALTER TABLE "events" ADD COLUMN "slug_lock" boolean DEFAULT true;
  ALTER TABLE "tenants" ADD COLUMN "cover_image_id" integer;
  ALTER TABLE "tenants" ADD COLUMN "location_address" varchar;
  ALTER TABLE "tenants" ADD COLUMN "location_map_url" varchar;
  ALTER TABLE "tenants" ADD COLUMN "location_latitude" numeric;
  ALTER TABLE "tenants" ADD COLUMN "location_longitude" numeric;
  ALTER TABLE "search" ADD COLUMN "event_date" timestamp(3) with time zone;
  ALTER TABLE "search" ADD COLUMN "location" varchar;
  ALTER TABLE "search" ADD COLUMN "era" varchar;
  ALTER TABLE "search_rels" ADD COLUMN "pages_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "archives_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "account_groups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gl_accounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "journal_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notifications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "favorites_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "members_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "archives_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "messages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "chat_rooms_id" integer;
  ALTER TABLE "header_nav_items" ADD COLUMN "_locale" "_locales" NOT NULL;
  ALTER TABLE "header_rels" ADD COLUMN "locale" "_locales";
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_fcm_tokens" ADD CONSTRAINT "users_fcm_tokens_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_tags" ADD CONSTRAINT "events_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_locales" ADD CONSTRAINT "events_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_parent_id_account_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."account_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_group_id_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."account_groups"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "journal_entries_lines" ADD CONSTRAINT "journal_entries_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "journal_entries_lines" ADD CONSTRAINT "journal_entries_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants_gallery" ADD CONSTRAINT "tenants_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants_gallery" ADD CONSTRAINT "tenants_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants_locales" ADD CONSTRAINT "tenants_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "favorites" ADD CONSTRAINT "favorites_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archives" ADD CONSTRAINT "archives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archives" ADD CONSTRAINT "archives_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archives_locales" ADD CONSTRAINT "archives_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."archives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages_rels" ADD CONSTRAINT "messages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages_rels" ADD CONSTRAINT "messages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "chat_rooms_rels" ADD CONSTRAINT "chat_rooms_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "chat_rooms_rels" ADD CONSTRAINT "chat_rooms_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_locales" ADD CONSTRAINT "forms_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_country_locales" ADD CONSTRAINT "forms_blocks_country_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_country"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email_locales" ADD CONSTRAINT "forms_blocks_email_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_email"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_message_locales" ADD CONSTRAINT "forms_blocks_message_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_message"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_number_locales" ADD CONSTRAINT "forms_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options_locales" ADD CONSTRAINT "forms_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_locales" ADD CONSTRAINT "forms_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_state_locales" ADD CONSTRAINT "forms_blocks_state_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text_locales" ADD CONSTRAINT "forms_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea_locales" ADD CONSTRAINT "forms_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_emails_locales" ADD CONSTRAINT "forms_emails_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_emails"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_locales" ADD CONSTRAINT "forms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_locales" ADD CONSTRAINT "search_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages_locales" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v_locales" USING btree ("version_meta_image_id");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts_locales" USING btree ("meta_image_id");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v_locales" USING btree ("version_meta_image_id");
  CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "_posts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "users_fcm_tokens_order_idx" ON "users_fcm_tokens" USING btree ("_order");
  CREATE INDEX "users_fcm_tokens_parent_id_idx" ON "users_fcm_tokens" USING btree ("_parent_id");
  CREATE INDEX "events_tags_order_idx" ON "events_tags" USING btree ("order");
  CREATE INDEX "events_tags_parent_idx" ON "events_tags" USING btree ("parent_id");
  CREATE UNIQUE INDEX "events_locales_locale_parent_id_unique" ON "events_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_rels_order_idx" ON "events_rels" USING btree ("order");
  CREATE INDEX "events_rels_parent_idx" ON "events_rels" USING btree ("parent_id");
  CREATE INDEX "events_rels_path_idx" ON "events_rels" USING btree ("path");
  CREATE INDEX "events_rels_events_id_idx" ON "events_rels" USING btree ("events_id");
  CREATE INDEX "account_groups_parent_idx" ON "account_groups" USING btree ("parent_id");
  CREATE INDEX "account_groups_tenant_idx" ON "account_groups" USING btree ("tenant_id");
  CREATE INDEX "account_groups_updated_at_idx" ON "account_groups" USING btree ("updated_at");
  CREATE INDEX "account_groups_created_at_idx" ON "account_groups" USING btree ("created_at");
  CREATE INDEX "gl_accounts_group_idx" ON "gl_accounts" USING btree ("group_id");
  CREATE INDEX "gl_accounts_tenant_idx" ON "gl_accounts" USING btree ("tenant_id");
  CREATE INDEX "gl_accounts_updated_at_idx" ON "gl_accounts" USING btree ("updated_at");
  CREATE INDEX "gl_accounts_created_at_idx" ON "gl_accounts" USING btree ("created_at");
  CREATE INDEX "journal_entries_lines_order_idx" ON "journal_entries_lines" USING btree ("_order");
  CREATE INDEX "journal_entries_lines_parent_id_idx" ON "journal_entries_lines" USING btree ("_parent_id");
  CREATE INDEX "journal_entries_lines_account_idx" ON "journal_entries_lines" USING btree ("account_id");
  CREATE INDEX "journal_entries_created_by_idx" ON "journal_entries" USING btree ("created_by_id");
  CREATE INDEX "journal_entries_tenant_idx" ON "journal_entries" USING btree ("tenant_id");
  CREATE INDEX "journal_entries_updated_at_idx" ON "journal_entries" USING btree ("updated_at");
  CREATE INDEX "journal_entries_created_at_idx" ON "journal_entries" USING btree ("created_at");
  CREATE INDEX "tenants_gallery_order_idx" ON "tenants_gallery" USING btree ("_order");
  CREATE INDEX "tenants_gallery_parent_id_idx" ON "tenants_gallery" USING btree ("_parent_id");
  CREATE INDEX "tenants_gallery_image_idx" ON "tenants_gallery" USING btree ("image_id");
  CREATE UNIQUE INDEX "tenants_locales_locale_parent_id_unique" ON "tenants_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");
  CREATE INDEX "favorites_event_idx" ON "favorites" USING btree ("event_id");
  CREATE INDEX "favorites_updated_at_idx" ON "favorites" USING btree ("updated_at");
  CREATE INDEX "favorites_created_at_idx" ON "favorites" USING btree ("created_at");
  CREATE INDEX "members_tenant_idx" ON "members" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "members_profile_image_idx" ON "members" USING btree ("profile_image_id");
  CREATE INDEX "members_member_id_idx" ON "members" USING btree ("member_id");
  CREATE INDEX "members_user_idx" ON "members" USING btree ("user_id");
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE INDEX "archives_tenant_idx" ON "archives" USING btree ("tenant_id");
  CREATE INDEX "archives_hero_image_idx" ON "archives" USING btree ("hero_image_id");
  CREATE INDEX "archives_slug_idx" ON "archives" USING btree ("slug");
  CREATE INDEX "archives_updated_at_idx" ON "archives" USING btree ("updated_at");
  CREATE INDEX "archives_created_at_idx" ON "archives" USING btree ("created_at");
  CREATE UNIQUE INDEX "archives_locales_locale_parent_id_unique" ON "archives_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "messages_tenant_idx" ON "messages" USING btree ("tenant_id");
  CREATE INDEX "messages_chat_room_idx" ON "messages" USING btree ("chat_room_id");
  CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE INDEX "messages_rels_order_idx" ON "messages_rels" USING btree ("order");
  CREATE INDEX "messages_rels_parent_idx" ON "messages_rels" USING btree ("parent_id");
  CREATE INDEX "messages_rels_path_idx" ON "messages_rels" USING btree ("path");
  CREATE INDEX "messages_rels_users_id_idx" ON "messages_rels" USING btree ("users_id");
  CREATE INDEX "chat_rooms_tenant_idx" ON "chat_rooms" USING btree ("tenant_id");
  CREATE INDEX "chat_rooms_updated_at_idx" ON "chat_rooms" USING btree ("updated_at");
  CREATE INDEX "chat_rooms_created_at_idx" ON "chat_rooms" USING btree ("created_at");
  CREATE INDEX "chat_rooms_rels_order_idx" ON "chat_rooms_rels" USING btree ("order");
  CREATE INDEX "chat_rooms_rels_parent_idx" ON "chat_rooms_rels" USING btree ("parent_id");
  CREATE INDEX "chat_rooms_rels_path_idx" ON "chat_rooms_rels" USING btree ("path");
  CREATE INDEX "chat_rooms_rels_users_id_idx" ON "chat_rooms_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_country_locales_locale_parent_id_unique" ON "forms_blocks_country_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_email_locales_locale_parent_id_unique" ON "forms_blocks_email_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_message_locales_locale_parent_id_unique" ON "forms_blocks_message_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_number_locales_locale_parent_id_unique" ON "forms_blocks_number_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_select_options_locales_locale_parent_id_unique" ON "forms_blocks_select_options_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_select_locales_locale_parent_id_unique" ON "forms_blocks_select_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_state_locales_locale_parent_id_unique" ON "forms_blocks_state_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_text_locales_locale_parent_id_unique" ON "forms_blocks_text_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_textarea_locales_locale_parent_id_unique" ON "forms_blocks_textarea_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_emails_locales_locale_parent_id_unique" ON "forms_emails_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "forms_locales_locale_parent_id_unique" ON "forms_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "search_locales_locale_parent_id_unique" ON "search_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "users" ADD CONSTRAINT "users_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_archives_fk" FOREIGN KEY ("archives_id") REFERENCES "public"."archives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_account_groups_fk" FOREIGN KEY ("account_groups_id") REFERENCES "public"."account_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gl_accounts_fk" FOREIGN KEY ("gl_accounts_id") REFERENCES "public"."gl_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_journal_entries_fk" FOREIGN KEY ("journal_entries_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_favorites_fk" FOREIGN KEY ("favorites_id") REFERENCES "public"."favorites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_archives_fk" FOREIGN KEY ("archives_id") REFERENCES "public"."archives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_chat_rooms_fk" FOREIGN KEY ("chat_rooms_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_cta_links_locale_idx" ON "pages_blocks_cta_links" USING btree ("_locale");
  CREATE INDEX "pages_blocks_cta_locale_idx" ON "pages_blocks_cta" USING btree ("_locale");
  CREATE INDEX "pages_blocks_content_columns_locale_idx" ON "pages_blocks_content_columns" USING btree ("_locale");
  CREATE INDEX "pages_blocks_content_locale_idx" ON "pages_blocks_content" USING btree ("_locale");
  CREATE INDEX "pages_blocks_media_block_locale_idx" ON "pages_blocks_media_block" USING btree ("_locale");
  CREATE INDEX "pages_blocks_archive_locale_idx" ON "pages_blocks_archive" USING btree ("_locale");
  CREATE INDEX "pages_blocks_form_block_locale_idx" ON "pages_blocks_form_block" USING btree ("_locale");
  CREATE INDEX "pages_rels_locale_idx" ON "pages_rels" USING btree ("locale");
  CREATE INDEX "_pages_v_blocks_cta_links_locale_idx" ON "_pages_v_blocks_cta_links" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_cta_locale_idx" ON "_pages_v_blocks_cta" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_content_columns_locale_idx" ON "_pages_v_blocks_content_columns" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_content_locale_idx" ON "_pages_v_blocks_content" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_media_block_locale_idx" ON "_pages_v_blocks_media_block" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_archive_locale_idx" ON "_pages_v_blocks_archive" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_form_block_locale_idx" ON "_pages_v_blocks_form_block" USING btree ("_locale");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_rels_locale_idx" ON "_pages_v_rels" USING btree ("locale");
  CREATE INDEX "_posts_v_snapshot_idx" ON "_posts_v" USING btree ("snapshot");
  CREATE INDEX "_posts_v_published_locale_idx" ON "_posts_v" USING btree ("published_locale");
  CREATE INDEX "categories_breadcrumbs_locale_idx" ON "categories_breadcrumbs" USING btree ("_locale");
  CREATE INDEX "users_image_idx" ON "users" USING btree ("image_id");
  CREATE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "tenants_cover_image_idx" ON "tenants" USING btree ("cover_image_id");
  CREATE INDEX "search_rels_pages_id_idx" ON "search_rels" USING btree ("pages_id");
  CREATE INDEX "search_rels_events_id_idx" ON "search_rels" USING btree ("events_id");
  CREATE INDEX "search_rels_archives_id_idx" ON "search_rels" USING btree ("archives_id");
  CREATE INDEX "payload_locked_documents_rels_account_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("account_groups_id");
  CREATE INDEX "payload_locked_documents_rels_gl_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("gl_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_journal_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("journal_entries_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_favorites_id_idx" ON "payload_locked_documents_rels" USING btree ("favorites_id");
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");
  CREATE INDEX "payload_locked_documents_rels_archives_id_idx" ON "payload_locked_documents_rels" USING btree ("archives_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_chat_rooms_id_idx" ON "payload_locked_documents_rels" USING btree ("chat_rooms_id");
  CREATE INDEX "header_nav_items_locale_idx" ON "header_nav_items" USING btree ("_locale");
  CREATE INDEX "header_rels_locale_idx" ON "header_rels" USING btree ("locale");
  CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id","locale");
  CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id","locale");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id","locale");
  CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id","locale");
  CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id","locale");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id","locale");
  CREATE INDEX "header_rels_pages_id_idx" ON "header_rels" USING btree ("pages_id","locale");
  CREATE INDEX "header_rels_posts_id_idx" ON "header_rels" USING btree ("posts_id","locale");
  ALTER TABLE "pages" DROP COLUMN "title";
  ALTER TABLE "pages" DROP COLUMN "meta_title";
  ALTER TABLE "pages" DROP COLUMN "meta_image_id";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "_pages_v" DROP COLUMN "version_title";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_image_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_description";
  ALTER TABLE "posts" DROP COLUMN "title";
  ALTER TABLE "posts" DROP COLUMN "content";
  ALTER TABLE "posts" DROP COLUMN "meta_title";
  ALTER TABLE "posts" DROP COLUMN "meta_image_id";
  ALTER TABLE "posts" DROP COLUMN "meta_description";
  ALTER TABLE "_posts_v" DROP COLUMN "version_title";
  ALTER TABLE "_posts_v" DROP COLUMN "version_content";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_image_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_meta_description";
  ALTER TABLE "media" DROP COLUMN "sizes_square_url";
  ALTER TABLE "media" DROP COLUMN "sizes_square_width";
  ALTER TABLE "media" DROP COLUMN "sizes_square_height";
  ALTER TABLE "media" DROP COLUMN "sizes_square_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_square_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_square_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_url";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_width";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_height";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_medium_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_url";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_width";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_height";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_xlarge_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_og_url";
  ALTER TABLE "media" DROP COLUMN "sizes_og_width";
  ALTER TABLE "media" DROP COLUMN "sizes_og_height";
  ALTER TABLE "media" DROP COLUMN "sizes_og_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_og_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_og_filename";
  ALTER TABLE "users" DROP COLUMN "image";
  ALTER TABLE "events" DROP COLUMN "title";
  ALTER TABLE "events" DROP COLUMN "description";
  ALTER TABLE "tenants" DROP COLUMN "name";
  ALTER TABLE "forms_blocks_checkbox" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_country" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_email" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_message" DROP COLUMN "message";
  ALTER TABLE "forms_blocks_number" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_select_options" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_select" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_select" DROP COLUMN "default_value";
  ALTER TABLE "forms_blocks_state" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_text" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_text" DROP COLUMN "default_value";
  ALTER TABLE "forms_blocks_textarea" DROP COLUMN "label";
  ALTER TABLE "forms_blocks_textarea" DROP COLUMN "default_value";
  ALTER TABLE "forms_emails" DROP COLUMN "subject";
  ALTER TABLE "forms_emails" DROP COLUMN "message";
  ALTER TABLE "forms" DROP COLUMN "submit_button_label";
  ALTER TABLE "forms" DROP COLUMN "confirmation_message";
  ALTER TABLE "search" DROP COLUMN "title";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_fcm_tokens" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "account_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "gl_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "journal_entries_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "journal_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "favorites" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "archives" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "archives_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "chat_rooms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "chat_rooms_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_country_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_email_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_message_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_number_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_select_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_select_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_state_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_textarea_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_emails_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "search_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "posts_locales" CASCADE;
  DROP TABLE "_posts_v_locales" CASCADE;
  DROP TABLE "users_fcm_tokens" CASCADE;
  DROP TABLE "events_tags" CASCADE;
  DROP TABLE "events_locales" CASCADE;
  DROP TABLE "events_rels" CASCADE;
  DROP TABLE "account_groups" CASCADE;
  DROP TABLE "gl_accounts" CASCADE;
  DROP TABLE "journal_entries_lines" CASCADE;
  DROP TABLE "journal_entries" CASCADE;
  DROP TABLE "tenants_gallery" CASCADE;
  DROP TABLE "tenants_locales" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "favorites" CASCADE;
  DROP TABLE "members" CASCADE;
  DROP TABLE "archives" CASCADE;
  DROP TABLE "archives_locales" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "messages_rels" CASCADE;
  DROP TABLE "chat_rooms" CASCADE;
  DROP TABLE "chat_rooms_rels" CASCADE;
  DROP TABLE "forms_blocks_checkbox_locales" CASCADE;
  DROP TABLE "forms_blocks_country_locales" CASCADE;
  DROP TABLE "forms_blocks_email_locales" CASCADE;
  DROP TABLE "forms_blocks_message_locales" CASCADE;
  DROP TABLE "forms_blocks_number_locales" CASCADE;
  DROP TABLE "forms_blocks_select_options_locales" CASCADE;
  DROP TABLE "forms_blocks_select_locales" CASCADE;
  DROP TABLE "forms_blocks_state_locales" CASCADE;
  DROP TABLE "forms_blocks_text_locales" CASCADE;
  DROP TABLE "forms_blocks_textarea_locales" CASCADE;
  DROP TABLE "forms_emails_locales" CASCADE;
  DROP TABLE "forms_locales" CASCADE;
  DROP TABLE "search_locales" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_image_id_media_id_fk";
  
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_cover_image_id_media_id_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_pages_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_events_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_archives_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_account_groups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gl_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_journal_entries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_favorites_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_archives_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_messages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_chat_rooms_fk";
  
  DROP INDEX "pages_blocks_cta_links_locale_idx";
  DROP INDEX "pages_blocks_cta_locale_idx";
  DROP INDEX "pages_blocks_content_columns_locale_idx";
  DROP INDEX "pages_blocks_content_locale_idx";
  DROP INDEX "pages_blocks_media_block_locale_idx";
  DROP INDEX "pages_blocks_archive_locale_idx";
  DROP INDEX "pages_blocks_form_block_locale_idx";
  DROP INDEX "pages_rels_locale_idx";
  DROP INDEX "_pages_v_blocks_cta_links_locale_idx";
  DROP INDEX "_pages_v_blocks_cta_locale_idx";
  DROP INDEX "_pages_v_blocks_content_columns_locale_idx";
  DROP INDEX "_pages_v_blocks_content_locale_idx";
  DROP INDEX "_pages_v_blocks_media_block_locale_idx";
  DROP INDEX "_pages_v_blocks_archive_locale_idx";
  DROP INDEX "_pages_v_blocks_form_block_locale_idx";
  DROP INDEX "_pages_v_snapshot_idx";
  DROP INDEX "_pages_v_published_locale_idx";
  DROP INDEX "_pages_v_rels_locale_idx";
  DROP INDEX "_posts_v_snapshot_idx";
  DROP INDEX "_posts_v_published_locale_idx";
  DROP INDEX "categories_breadcrumbs_locale_idx";
  DROP INDEX "users_image_idx";
  DROP INDEX "events_slug_idx";
  DROP INDEX "tenants_cover_image_idx";
  DROP INDEX "search_rels_pages_id_idx";
  DROP INDEX "search_rels_events_id_idx";
  DROP INDEX "search_rels_archives_id_idx";
  DROP INDEX "payload_locked_documents_rels_account_groups_id_idx";
  DROP INDEX "payload_locked_documents_rels_gl_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_journal_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_notifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_favorites_id_idx";
  DROP INDEX "payload_locked_documents_rels_members_id_idx";
  DROP INDEX "payload_locked_documents_rels_archives_id_idx";
  DROP INDEX "payload_locked_documents_rels_messages_id_idx";
  DROP INDEX "payload_locked_documents_rels_chat_rooms_id_idx";
  DROP INDEX "header_nav_items_locale_idx";
  DROP INDEX "header_rels_locale_idx";
  DROP INDEX "pages_rels_pages_id_idx";
  DROP INDEX "pages_rels_posts_id_idx";
  DROP INDEX "pages_rels_categories_id_idx";
  DROP INDEX "_pages_v_rels_pages_id_idx";
  DROP INDEX "_pages_v_rels_posts_id_idx";
  DROP INDEX "_pages_v_rels_categories_id_idx";
  DROP INDEX "header_rels_pages_id_idx";
  DROP INDEX "header_rels_posts_id_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-02-26T08:54:55.908Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-02-26T08:54:55.909Z';
  ALTER TABLE "pages" ADD COLUMN "title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_image_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "posts" ADD COLUMN "title" varchar;
  ALTER TABLE "posts" ADD COLUMN "content" jsonb;
  ALTER TABLE "posts" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "posts" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "posts" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_content" jsonb;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_image_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_square_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_square_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_square_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_square_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_square_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_square_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_medium_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_xlarge_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_og_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_og_filename" varchar;
  ALTER TABLE "users" ADD COLUMN "image" varchar;
  ALTER TABLE "events" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "events" ADD COLUMN "description" varchar;
  ALTER TABLE "tenants" ADD COLUMN "name" varchar NOT NULL;
  ALTER TABLE "forms_blocks_checkbox" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_country" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_email" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_message" ADD COLUMN "message" jsonb;
  ALTER TABLE "forms_blocks_number" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_select_options" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "forms_blocks_select" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_select" ADD COLUMN "default_value" varchar;
  ALTER TABLE "forms_blocks_state" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_text" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_text" ADD COLUMN "default_value" varchar;
  ALTER TABLE "forms_blocks_textarea" ADD COLUMN "label" varchar;
  ALTER TABLE "forms_blocks_textarea" ADD COLUMN "default_value" varchar;
  ALTER TABLE "forms_emails" ADD COLUMN "subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL;
  ALTER TABLE "forms_emails" ADD COLUMN "message" jsonb;
  ALTER TABLE "forms" ADD COLUMN "submit_button_label" varchar;
  ALTER TABLE "forms" ADD COLUMN "confirmation_message" jsonb;
  ALTER TABLE "search" ADD COLUMN "title" varchar;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v" USING btree ("version_meta_image_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts" USING btree ("meta_image_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "media_sizes_square_sizes_square_filename_idx" ON "media" USING btree ("sizes_square_filename");
  CREATE INDEX "media_sizes_medium_sizes_medium_filename_idx" ON "media" USING btree ("sizes_medium_filename");
  CREATE INDEX "media_sizes_xlarge_sizes_xlarge_filename_idx" ON "media" USING btree ("sizes_xlarge_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id");
  CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id");
  CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id");
  CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id");
  CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id");
  CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id");
  CREATE INDEX "header_rels_pages_id_idx" ON "header_rels" USING btree ("pages_id");
  CREATE INDEX "header_rels_posts_id_idx" ON "header_rels" USING btree ("posts_id");
  ALTER TABLE "pages_blocks_cta_links" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_cta" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_content_columns" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_content" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_media_block" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_archive" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_form_block" DROP COLUMN "_locale";
  ALTER TABLE "pages_rels" DROP COLUMN "locale";
  ALTER TABLE "_pages_v_blocks_cta_links" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_cta" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_content_columns" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_content" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_media_block" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_archive" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_form_block" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v" DROP COLUMN "snapshot";
  ALTER TABLE "_pages_v" DROP COLUMN "published_locale";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "locale";
  ALTER TABLE "_posts_v" DROP COLUMN "snapshot";
  ALTER TABLE "_posts_v" DROP COLUMN "published_locale";
  ALTER TABLE "categories_breadcrumbs" DROP COLUMN "_locale";
  ALTER TABLE "users" DROP COLUMN "image_id";
  ALTER TABLE "users" DROP COLUMN "phone_number";
  ALTER TABLE "users" DROP COLUMN "gender";
  ALTER TABLE "users" DROP COLUMN "enable_a_p_i_key";
  ALTER TABLE "users" DROP COLUMN "api_key";
  ALTER TABLE "users" DROP COLUMN "api_key_index";
  ALTER TABLE "events" DROP COLUMN "slug";
  ALTER TABLE "events" DROP COLUMN "slug_lock";
  ALTER TABLE "tenants" DROP COLUMN "cover_image_id";
  ALTER TABLE "tenants" DROP COLUMN "location_address";
  ALTER TABLE "tenants" DROP COLUMN "location_map_url";
  ALTER TABLE "tenants" DROP COLUMN "location_latitude";
  ALTER TABLE "tenants" DROP COLUMN "location_longitude";
  ALTER TABLE "search" DROP COLUMN "event_date";
  ALTER TABLE "search" DROP COLUMN "location";
  ALTER TABLE "search" DROP COLUMN "era";
  ALTER TABLE "search_rels" DROP COLUMN "pages_id";
  ALTER TABLE "search_rels" DROP COLUMN "events_id";
  ALTER TABLE "search_rels" DROP COLUMN "archives_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "account_groups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gl_accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "journal_entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "favorites_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "archives_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "messages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "chat_rooms_id";
  ALTER TABLE "header_nav_items" DROP COLUMN "_locale";
  ALTER TABLE "header_rels" DROP COLUMN "locale";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum__posts_v_published_locale";
  DROP TYPE "public"."enum_users_gender";
  DROP TYPE "public"."enum_events_tags";
  DROP TYPE "public"."enum_account_groups_type";
  DROP TYPE "public"."enum_gl_accounts_type";
  DROP TYPE "public"."enum_gl_accounts_class";
  DROP TYPE "public"."enum_journal_entries_status";
  DROP TYPE "public"."enum_notifications_type";
  DROP TYPE "public"."enum_members_role";
  DROP TYPE "public"."enum_members_status";
  DROP TYPE "public"."enum_chat_rooms_type";`)
}
