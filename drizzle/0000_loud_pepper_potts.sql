CREATE TYPE "public"."department" AS ENUM('SALES', 'SALES CABANG', 'SALES ADMIN', 'SALES ADMIN CABANG', 'FA', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('STAFF', 'MANAGER', 'SENIOR MANAGER', 'CHIEF');--> statement-breakpoint
CREATE TYPE "public"."perm_action" AS ENUM('index', 'show', 'new', 'create', 'edit', 'update', 'destroy', 'autocomplete', 'cru', 'crud');--> statement-breakpoint
CREATE TYPE "public"."perm_model" AS ENUM('Customer', 'Item', 'Quotation', 'User');--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('SELF', 'BRANCH', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_kind" AS ENUM('category', 'sub_category_1', 'sub_category_2', 'series');--> statement-breakpoint
CREATE TABLE "audit_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"model" text NOT NULL,
	"record_id" integer,
	"event" text,
	"user_id" integer,
	"user_label" text,
	"changeset" jsonb,
	"legacy_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_versions_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"cust_code" text NOT NULL,
	"company_name" text,
	"brand" text,
	"group_name" text,
	"category" text,
	"address" text,
	"pic_name" text,
	"pic_phone" text,
	"pic_email" text,
	"default_sales_id" integer,
	"branch_id" integer,
	"legacy_created_at" timestamp with time zone,
	"legacy_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "customers_cust_code_unique" UNIQUE("cust_code")
);
--> statement-breakpoint
CREATE TABLE "item_brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_brands_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "item_buy_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"item_id" integer NOT NULL,
	"name" text,
	"price" numeric(20, 4),
	"currency" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_buy_prices_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "item_cost_multis" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"item_id" integer NOT NULL,
	"description" text,
	"multiplier" numeric(18, 8),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_cost_multis_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"sys_id" text NOT NULL,
	"item_code" text,
	"model" text,
	"brand_id" integer,
	"category_id" integer,
	"sub_category_1_id" integer,
	"sub_category_2_id" integer,
	"series_id" integer,
	"permission" text,
	"sort_order" integer,
	"image_url" text,
	"sell_price_currency" text,
	"sell_price_tier_0" numeric(20, 4),
	"sell_price_tier_1" numeric(20, 4),
	"sell_price_tier_2" numeric(20, 4),
	"sell_price_tier_3" numeric(20, 4),
	"sell_price_tier_4" numeric(20, 4),
	"sell_price_tier_5" numeric(20, 4),
	"default_cost_currency" text,
	"default_delivery_cost" numeric(20, 4),
	"description" text,
	"key_specification" text,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legacy_created_at" timestamp with time zone,
	"legacy_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "items_sys_id_unique" UNIQUE("sys_id")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"department" "department" NOT NULL,
	"level_min" "level" DEFAULT 'STAFF' NOT NULL,
	"level_max" "level" DEFAULT 'CHIEF' NOT NULL,
	"model" "perm_model" NOT NULL,
	"action" "perm_action" NOT NULL,
	"scope" "scope" NOT NULL,
	"source_field" text,
	"dest_field" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_additional_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"quotation_id" integer NOT NULL,
	"line_no" integer,
	"label" text,
	"amount" numeric(20, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_additional_items_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"quotation_id" integer NOT NULL,
	"line_no" integer,
	"item_id" integer,
	"item_label" text,
	"qty" numeric(16, 4),
	"currency" text,
	"price" numeric(20, 4),
	"delivery_cost" numeric(20, 4),
	"install_cost" numeric(20, 4),
	"remarks" text,
	"price_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_items_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"q_code" text,
	"q_rev" integer DEFAULT 0 NOT NULL,
	"parent_quotation_id" integer,
	"q_date" date,
	"q_subject" text,
	"company_name" text,
	"q_currency" text,
	"q_lang" text,
	"q_type" text,
	"q_status" text,
	"q_price_approval" text,
	"customer_id" integer,
	"customer_pic" text,
	"sales_id" integer,
	"sales_admin_id" integer,
	"branch_id" integer,
	"include_di_in_price" boolean DEFAULT false NOT NULL,
	"round_idr_option" boolean DEFAULT false NOT NULL,
	"franco" text,
	"delivery" text,
	"installation" text,
	"validity" text,
	"warranty" text,
	"payment" text,
	"ppn" text,
	"terms_others" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"q_notes" text,
	"cat_internal" text,
	"fx_usd_idr" numeric(18, 8),
	"fx_eur_usd" numeric(18, 8),
	"fx_sgd_usd" numeric(18, 8),
	"fx_jpy_usd" numeric(18, 8),
	"fx_nzd_usd" numeric(18, 8),
	"fx_gbp_usd" numeric(18, 8),
	"fx_krw_usd" numeric(18, 8),
	"fx_rmb_usd" numeric(18, 8),
	"fx_sek_usd" numeric(18, 8),
	"created_by_id" integer,
	"updated_by_id" integer,
	"legacy_created_at" timestamp with time zone,
	"legacy_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value_decimal" numeric(20, 8),
	"value_string" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "taxonomies" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"kind" "taxonomy_kind" NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"department" "department",
	"level" "level",
	"branch_id" integer,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_versions" ADD CONSTRAINT "audit_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_default_sales_id_users_id_fk" FOREIGN KEY ("default_sales_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_buy_prices" ADD CONSTRAINT "item_buy_prices_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_cost_multis" ADD CONSTRAINT "item_cost_multis_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_brand_id_item_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."item_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_taxonomies_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_sub_category_1_id_taxonomies_id_fk" FOREIGN KEY ("sub_category_1_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_sub_category_2_id_taxonomies_id_fk" FOREIGN KEY ("sub_category_2_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_series_id_taxonomies_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_additional_items" ADD CONSTRAINT "quotation_additional_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_parent_quotation_id_quotations_id_fk" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_id_users_id_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_sales_admin_id_users_id_fk" FOREIGN KEY ("sales_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_parent_id_taxonomies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_versions_record_idx" ON "audit_versions" USING btree ("model","record_id");--> statement-breakpoint
CREATE INDEX "audit_versions_user_idx" ON "audit_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_company_idx" ON "customers" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "customers_group_idx" ON "customers" USING btree ("group_name");--> statement-breakpoint
CREATE INDEX "customers_category_idx" ON "customers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "customers_default_sales_idx" ON "customers" USING btree ("default_sales_id");--> statement-breakpoint
CREATE INDEX "customers_branch_idx" ON "customers" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "item_buy_prices_item_idx" ON "item_buy_prices" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_cost_multis_item_idx" ON "item_cost_multis" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_brand_idx" ON "items" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "items_sub1_idx" ON "items" USING btree ("sub_category_1_id");--> statement-breakpoint
CREATE INDEX "items_sub2_idx" ON "items" USING btree ("sub_category_2_id");--> statement-breakpoint
CREATE INDEX "items_series_idx" ON "items" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "items_model_idx" ON "items" USING btree ("model");--> statement-breakpoint
CREATE INDEX "permissions_lookup_idx" ON "permissions" USING btree ("department","model","action");--> statement-breakpoint
CREATE INDEX "quotation_additional_items_quotation_idx" ON "quotation_additional_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotation_items_quotation_idx" ON "quotation_items" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotations_qcode_idx" ON "quotations" USING btree ("q_code");--> statement-breakpoint
CREATE INDEX "quotations_customer_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_sales_idx" ON "quotations" USING btree ("sales_id");--> statement-breakpoint
CREATE INDEX "quotations_branch_idx" ON "quotations" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("q_status");--> statement-breakpoint
CREATE INDEX "quotations_date_idx" ON "quotations" USING btree ("q_date");--> statement-breakpoint
CREATE INDEX "quotations_parent_idx" ON "quotations" USING btree ("parent_quotation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomies_kind_legacy_idx" ON "taxonomies" USING btree ("kind","legacy_id");--> statement-breakpoint
CREATE INDEX "taxonomies_kind_idx" ON "taxonomies" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "taxonomies_parent_idx" ON "taxonomies" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "users_branch_idx" ON "users" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "users_dept_idx" ON "users" USING btree ("department");