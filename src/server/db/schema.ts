import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  DEPARTMENTS,
  LEVELS,
  PERM_ACTIONS,
  PERM_MODELS,
  SCOPES,
  TAXONOMY_KINDS,
} from "@/lib/constants";

/* ============================================================
 * Enums (CONTROLLED domain — see src/lib/constants.ts)
 * ========================================================== */
export const departmentEnum = pgEnum("department", DEPARTMENTS);
export const levelEnum = pgEnum("level", LEVELS);
export const scopeEnum = pgEnum("scope", SCOPES);
export const permModelEnum = pgEnum("perm_model", PERM_MODELS);
export const permActionEnum = pgEnum("perm_action", PERM_ACTIONS);
export const taxonomyKindEnum = pgEnum("taxonomy_kind", TAXONOMY_KINDS);

// Reusable column helpers. Money/qty/fx kept as `numeric` (Drizzle returns a
// string) so we never lose precision to float — the pricing engine uses decimal.js.
const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
const rate = (name: string) => numeric(name, { precision: 18, scale: 8 });
const qty = (name: string) => numeric(name, { precision: 16, scale: 4 });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ============================================================
 * Administration
 * ========================================================== */

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  legacyId: integer("legacy_id").unique(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    nickname: text("nickname"),
    department: departmentEnum("department"),
    level: levelEnum("level"),
    branchId: integer("branch_id").references(() => branches.id),
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_branch_idx").on(t.branchId), index("users_dept_idx").on(t.department)],
);

/**
 * Row-level permission rules ported from /roles. A rule grants (model::action)
 * to a department for the level range [levelMin..levelMax], with a row scope of
 * SELF / BRANCH / ALL. For SELF, `sourceField` (a column on the user) is matched
 * against `destField` (a column on the target row).
 */
export const permissions = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    department: departmentEnum("department").notNull(),
    levelMin: levelEnum("level_min").notNull().default("STAFF"),
    levelMax: levelEnum("level_max").notNull().default("CHIEF"),
    model: permModelEnum("model").notNull(),
    action: permActionEnum("action").notNull(),
    scope: scopeEnum("scope").notNull(),
    sourceField: text("source_field"),
    destField: text("dest_field"),
    createdAt: createdAt(),
  },
  (t) => [index("permissions_lookup_idx").on(t.department, t.model, t.action)],
);

/** Global key/value settings — notably the CURR_RATE_* FX table. */
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueDecimal: numeric("value_decimal", { precision: 20, scale: 8 }),
  valueString: text("value_string"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ============================================================
 * Catalog
 * ========================================================== */

export const itemBrands = pgTable("item_brands", {
  id: serial("id").primaryKey(),
  legacyId: integer("legacy_id").unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** category / sub_category_1 / sub_category_2 / series folded into one table. */
export const taxonomies = pgTable(
  "taxonomies",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id"),
    kind: taxonomyKindEnum("kind").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").references((): AnyPgColumn => taxonomies.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("taxonomies_kind_legacy_idx").on(t.kind, t.legacyId),
    index("taxonomies_kind_idx").on(t.kind),
    index("taxonomies_parent_idx").on(t.parentId),
  ],
);

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    sysId: text("sys_id").notNull().unique(),
    itemCode: text("item_code"),
    model: text("model"),
    brandId: integer("brand_id").references(() => itemBrands.id),
    categoryId: integer("category_id").references(() => taxonomies.id),
    subCategory1Id: integer("sub_category_1_id").references(() => taxonomies.id),
    subCategory2Id: integer("sub_category_2_id").references(() => taxonomies.id),
    seriesId: integer("series_id").references(() => taxonomies.id),
    permission: text("permission"),
    sortOrder: integer("sort_order"),
    imageUrl: text("image_url"),
    // Pricing
    sellPriceCurrency: text("sell_price_currency"),
    sellPriceTier0: money("sell_price_tier_0"),
    sellPriceTier1: money("sell_price_tier_1"),
    sellPriceTier2: money("sell_price_tier_2"),
    sellPriceTier3: money("sell_price_tier_3"),
    sellPriceTier4: money("sell_price_tier_4"),
    sellPriceTier5: money("sell_price_tier_5"),
    defaultCostCurrency: text("default_cost_currency"),
    defaultDeliveryCost: money("default_delivery_cost"),
    // Specification
    description: text("description"),
    keySpecification: text("key_specification"),
    /** The remaining ~45 spec/description fields, captured verbatim during scrape. */
    specs: jsonb("specs").notNull().default(sql`'{}'::jsonb`),
    legacyCreatedAt: timestamp("legacy_created_at", { withTimezone: true }),
    legacyUpdatedAt: timestamp("legacy_updated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("items_brand_idx").on(t.brandId),
    index("items_category_idx").on(t.categoryId),
    index("items_sub1_idx").on(t.subCategory1Id),
    index("items_sub2_idx").on(t.subCategory2Id),
    index("items_series_idx").on(t.seriesId),
    index("items_model_idx").on(t.model),
  ],
);

export const itemBuyPrices = pgTable(
  "item_buy_prices",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    name: text("name"),
    price: money("price"),
    currency: text("currency"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("item_buy_prices_item_idx").on(t.itemId)],
);

export const itemCostMultis = pgTable(
  "item_cost_multis",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    description: text("description"),
    multiplier: rate("multiplier"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("item_cost_multis_item_idx").on(t.itemId)],
);

/* ============================================================
 * Sales — Customers & Quotations
 * ========================================================== */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    custCode: text("cust_code").notNull().unique(),
    companyName: text("company_name"),
    brand: text("brand"),
    groupName: text("group_name"),
    category: text("category"),
    address: text("address"),
    picName: text("pic_name"),
    picPhone: text("pic_phone"),
    picEmail: text("pic_email"),
    defaultSalesId: integer("default_sales_id").references(() => users.id),
    branchId: integer("branch_id").references(() => branches.id),
    legacyCreatedAt: timestamp("legacy_created_at", { withTimezone: true }),
    legacyUpdatedAt: timestamp("legacy_updated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("customers_company_idx").on(t.companyName),
    index("customers_group_idx").on(t.groupName),
    index("customers_category_idx").on(t.category),
    index("customers_default_sales_idx").on(t.defaultSalesId),
    index("customers_branch_idx").on(t.branchId),
  ],
);

export const quotations = pgTable(
  "quotations",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    qCode: text("q_code"),
    qRev: integer("q_rev").notNull().default(0),
    parentQuotationId: integer("parent_quotation_id").references((): AnyPgColumn => quotations.id),
    qDate: date("q_date"),
    qSubject: text("q_subject"),
    companyName: text("company_name"),
    qCurrency: text("q_currency"),
    qLang: text("q_lang"),
    qType: text("q_type"),
    qStatus: text("q_status"),
    qPriceApproval: text("q_price_approval"),
    customerId: integer("customer_id").references(() => customers.id),
    customerPic: text("customer_pic"),
    salesId: integer("sales_id").references(() => users.id),
    salesAdminId: integer("sales_admin_id").references(() => users.id),
    branchId: integer("branch_id").references(() => branches.id),
    includeDiInPrice: boolean("include_di_in_price").notNull().default(false),
    roundIdrOption: boolean("round_idr_option").notNull().default(false),
    // Terms (selects). Any "<term>_others" free text goes in termsOthers.
    franco: text("franco"),
    delivery: text("delivery"),
    installation: text("installation"),
    validity: text("validity"),
    warranty: text("warranty"),
    payment: text("payment"),
    ppn: text("ppn"),
    termsOthers: jsonb("terms_others").notNull().default(sql`'{}'::jsonb`),
    qNotes: text("q_notes"),
    catInternal: text("cat_internal"),
    // FX snapshot copied from settings at creation time.
    fxUsdIdr: rate("fx_usd_idr"),
    fxEurUsd: rate("fx_eur_usd"),
    fxSgdUsd: rate("fx_sgd_usd"),
    fxJpyUsd: rate("fx_jpy_usd"),
    fxNzdUsd: rate("fx_nzd_usd"),
    fxGbpUsd: rate("fx_gbp_usd"),
    fxKrwUsd: rate("fx_krw_usd"),
    fxRmbUsd: rate("fx_rmb_usd"),
    fxSekUsd: rate("fx_sek_usd"),
    createdById: integer("created_by_id").references(() => users.id),
    updatedById: integer("updated_by_id").references(() => users.id),
    legacyCreatedAt: timestamp("legacy_created_at", { withTimezone: true }),
    legacyUpdatedAt: timestamp("legacy_updated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("quotations_qcode_idx").on(t.qCode),
    index("quotations_customer_idx").on(t.customerId),
    index("quotations_sales_idx").on(t.salesId),
    index("quotations_branch_idx").on(t.branchId),
    index("quotations_status_idx").on(t.qStatus),
    index("quotations_date_idx").on(t.qDate),
    index("quotations_parent_idx").on(t.parentQuotationId),
  ],
);

export const quotationItems = pgTable(
  "quotation_items",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    lineNo: integer("line_no"),
    itemId: integer("item_id").references(() => items.id),
    itemLabel: text("item_label"),
    qty: qty("qty"),
    currency: text("currency"),
    price: money("price"),
    deliveryCost: money("delivery_cost"),
    installCost: money("install_cost"),
    remarks: text("remarks"),
    /** Snapshot of the pricing basis, e.g. {"tier":3,"adjPct":1.3}. */
    priceData: jsonb("price_data"),
    createdAt: createdAt(),
  },
  (t) => [index("quotation_items_quotation_idx").on(t.quotationId)],
);

export const quotationAdditionalItems = pgTable(
  "quotation_additional_items",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    quotationId: integer("quotation_id")
      .notNull()
      .references(() => quotations.id, { onDelete: "cascade" }),
    lineNo: integer("line_no"),
    label: text("label"),
    amount: money("amount"),
    createdAt: createdAt(),
  },
  (t) => [index("quotation_additional_items_quotation_idx").on(t.quotationId)],
);

/* ============================================================
 * Audit trail (ports /statics/*_logs — PaperTrail-style)
 * ========================================================== */

export const auditVersions = pgTable(
  "audit_versions",
  {
    id: serial("id").primaryKey(),
    legacyId: integer("legacy_id").unique(),
    model: text("model").notNull(),
    recordId: integer("record_id"),
    event: text("event"),
    userId: integer("user_id").references(() => users.id),
    userLabel: text("user_label"),
    /** Array of { field, before, after } entries. */
    changeset: jsonb("changeset"),
    legacyCreatedAt: timestamp("legacy_created_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_versions_record_idx").on(t.model, t.recordId),
    index("audit_versions_user_idx").on(t.userId),
  ],
);
