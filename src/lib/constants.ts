/**
 * Central domain constants ported from the legacy Rails intranet.
 *
 * Two tiers:
 *  - CONTROLLED (used as Postgres enums): department, level, scope, permission
 *    model/action. We own these via seed data, so a strict enum is safe.
 *  - SCRAPED (stored as `text`, listed here only for the UI/validation): company,
 *    currency, quotation status/type/lang, terms. Kept flexible so importing
 *    legacy rows never fails on an unforeseen value.
 */

/* ============================================================
 * Auth / permission domain (CONTROLLED — becomes pg enums)
 * ========================================================== */

/** Departments seen on /roles + /users. */
export const DEPARTMENTS = [
  "SALES",
  "SALES CABANG",
  "SALES ADMIN",
  "SALES ADMIN CABANG",
  "FA",
  "ALL",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Org levels, low → high. Ranges on /roles are written "STAFF s/d CHIEF". */
export const LEVELS = ["STAFF", "MANAGER", "SENIOR MANAGER", "CHIEF"] as const;
export type Level = (typeof LEVELS)[number];

/** Numeric ordering so "X s/d CHIEF" ranges can be evaluated. */
export const LEVEL_ORDER: Record<Level, number> = {
  STAFF: 0,
  MANAGER: 1,
  "SENIOR MANAGER": 2,
  CHIEF: 3,
};

/** Row-scope of a permission rule. */
export const SCOPES = ["SELF", "BRANCH", "ALL"] as const;
export type Scope = (typeof SCOPES)[number];

/** Guarded models (Sales Order intentionally excluded from the clone). */
export const PERM_MODELS = ["Customer", "Item", "Quotation", "User"] as const;
export type PermModel = (typeof PERM_MODELS)[number];

/**
 * Actions seen on /roles. `cru` / `crud` are shorthand bundles that expand into
 * the primitive verbs below (crud additionally grants delete).
 */
export const PERM_ACTIONS = [
  "index",
  "show",
  "new",
  "create",
  "edit",
  "update",
  "destroy",
  "autocomplete",
  "cru",
  "crud",
] as const;
export type PermAction = (typeof PERM_ACTIONS)[number];

/** Primitive verbs that a rule ultimately grants. */
export const PRIMITIVE_ACTIONS = [
  "index",
  "show",
  "new",
  "create",
  "edit",
  "update",
  "destroy",
  "autocomplete",
] as const;
export type PrimitiveAction = (typeof PRIMITIVE_ACTIONS)[number];

/** Expand a stored action into the primitive verbs it grants. */
export function expandAction(action: PermAction): PrimitiveAction[] {
  switch (action) {
    case "cru":
      return ["index", "show", "new", "create", "edit", "update"];
    case "crud":
      return ["index", "show", "new", "create", "edit", "update", "destroy"];
    default:
      return [action];
  }
}

/* ============================================================
 * Quotation / catalog domain (SCRAPED — stored as text)
 * ========================================================== */

/** Legal entities; drives PDF letterhead. */
export const COMPANIES = ["SARANA", "GASTRO", "RSP"] as const;
export type Company = (typeof COMPANIES)[number];

/**
 * Currencies from the line-item + item price dropdowns. IDR is the base
 * reporting currency; the rest convert via a quotation's snapshotted FX rates.
 */
export const CURRENCIES = [
  "IDR",
  "USD",
  "EUR",
  "SGD",
  "JPY",
  "NZD",
  "GBP",
  "KRW",
  "RMB",
  "SEK",
] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Quotation statuses observed in the UI (kept open — column is text). */
export const QUOTATION_STATUSES = ["DRAFT", "SENT", "INTERNAL"] as const;

/** Number of sell-price tiers on an item (sell_price_tier_0..5). */
export const SELL_PRICE_TIERS = 6;

/**
 * Settings keys that carry the global FX table (copied into each quotation as a
 * snapshot at creation time). Value is "<FROM>_<TO>" (multiply amount in FROM by
 * the rate to get TO).
 */
export const FX_SETTING_KEYS = [
  "CURR_RATE_USD_IDR",
  "CURR_RATE_EUR_USD",
  "CURR_RATE_SGD_USD",
  "CURR_RATE_JPY_USD",
  "CURR_RATE_NZD_USD",
  "CURR_RATE_GBP_USD",
  "CURR_RATE_KRW_USD",
  "CURR_RATE_RMB_USD",
  "CURR_RATE_SEK_USD",
] as const;

/** Taxonomy kinds folded into the single `taxonomies` table. */
export const TAXONOMY_KINDS = ["category", "sub_category_1", "sub_category_2", "series"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];
