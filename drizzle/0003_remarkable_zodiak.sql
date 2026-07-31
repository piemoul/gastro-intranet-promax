ALTER TABLE "items" DROP CONSTRAINT "items_sys_id_unique";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "accurate_company_id" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "accurate_customer_no" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "accurate_id" integer;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "accurate_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "accurate_company_id" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "accurate_id" integer;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "unit_name" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "item_type" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_status" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_submitted_by_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_approved_by_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "so_rejection_reason" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "accurate_so_number" text;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "accurate_so_id" integer;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "accurate_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_so_submitted_by_id_users_id_fk" FOREIGN KEY ("so_submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_so_approved_by_id_users_id_fk" FOREIGN KEY ("so_approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "items_company_sysid_idx" ON "items" USING btree ("accurate_company_id","sys_id");--> statement-breakpoint
CREATE INDEX "items_accurate_idx" ON "items" USING btree ("accurate_company_id","accurate_id");--> statement-breakpoint
CREATE INDEX "quotations_so_status_idx" ON "quotations" USING btree ("so_status");