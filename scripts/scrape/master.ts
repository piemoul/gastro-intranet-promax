/**
 * Master-data importer (READ-ONLY scrape → Neon). Run locally with a valid
 * LEGACY_COOKIE:  npm run scrape:master
 *
 * Order:
 *   1. reference: item_brands + taxonomies (from an item edit form's <option>s)
 *   2. users (from /users index) — matched to branches by name
 *   3. items    (enumerate /items/:id/edit + buy_prices + cost_multis)
 *   4. customers (enumerate /customers/:id/edit)
 *
 * CSV export endpoints are admin-gated (a SALES CHIEF cannot use them), so we
 * scrape HTML. Enumeration is idempotent (upsert by legacy_id) and resumable.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, sql as pg } from "../_db";
import {
  branches,
  customers,
  itemBrands,
  itemBuyPrices,
  itemCostMultis,
  items,
  taxonomies,
  users,
} from "@/server/db/schema";
import { getArchived, StaleSessionError } from "./legacy-client";
import { parseForm, parseIndexTable, parseNameValueTable, parseSelectOptions } from "./parse";
import { loadCheckpoint, saveCheckpoint } from "./checkpoint";

const MAX_ITEM_ID = Number(process.env.SCRAPE_MAX_ITEM_ID ?? 7600);
const MAX_CUSTOMER_ID = Number(process.env.SCRAPE_MAX_CUSTOMER_ID ?? 6000);

/* ---------- reference: brands + taxonomy from a sample item form ---------- */
async function importReference(sampleItemId: number) {
  const html = await getArchived(`/items/${sampleItemId}/edit`, `items/${sampleItemId}-edit`);
  if (!html) throw new Error(`Sample item ${sampleItemId} not found; set SCRAPE_SAMPLE_ITEM_ID.`);

  const brandOpts = parseSelectOptions(html, "item_brand_id");
  for (const o of brandOpts) {
    await db
      .insert(itemBrands)
      .values({ legacyId: Number(o.value), name: o.text })
      .onConflictDoUpdate({ target: itemBrands.legacyId, set: { name: o.text } });
  }

  const kinds: [string, "category" | "sub_category_1" | "sub_category_2" | "series"][] = [
    ["category_id", "category"],
    ["sub_category_1_id", "sub_category_1"],
    ["sub_category_2_id", "sub_category_2"],
    ["series_id", "series"],
  ];
  for (const [sel, kind] of kinds) {
    for (const o of parseSelectOptions(html, sel)) {
      await db
        .insert(taxonomies)
        .values({ legacyId: Number(o.value), kind, name: o.text })
        .onConflictDoNothing();
    }
  }
  console.log(`  reference: ${brandOpts.length} brands + taxonomy imported`);
}

/* ---------- users from the index page ---------- */
async function importUsers() {
  const html = await getArchived("/users", "users/index");
  if (!html) return console.log("  users: not accessible with this account (admin-gated)");
  const { rows } = parseIndexTable(html);
  const branchRows = await db.select().from(branches);
  const branchByName = new Map(branchRows.map((b) => [b.name, b.id]));

  let n = 0;
  for (const r of rows) {
    // columns: E-mail | Name | Nickname | Department (Level) | Branch
    const [email, name, nickname, deptLevel, branchName] = r.cells;
    if (!email) continue;
    // The row's edit/show link carries the legacy id: /users/<id>[/edit].
    const legacyId = Number(r.links.map((l) => l.match(/\/users\/(\d+)/)?.[1]).find(Boolean));
    const dm = deptLevel?.match(/^(.*?)\s*\(Level:\s*(.*?)\)/);
    const department = dm?.[1]?.trim() || null;
    const level = dm?.[2]?.trim() || null;
    const branchId = branchName ? (branchByName.get(branchName.trim()) ?? null) : null;
    await db
      .insert(users)
      .values({
        legacyId: Number.isFinite(legacyId) ? legacyId : null,
        email: email.toLowerCase(),
        name: name || email,
        nickname: nickname || null,
        department,
        level,
        branchId,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          legacyId: Number.isFinite(legacyId) ? legacyId : null,
          name: name || email,
          nickname: nickname || null,
          department,
          level,
          branchId,
        },
      });
    n++;
  }
  console.log(`  users: ${n} upserted`);
}

/* ---------- items ---------- */
async function resolveFk(table: typeof itemBrands | typeof taxonomies, legacyId: string, kind?: string) {
  if (!legacyId) return null;
  const id = Number(legacyId);
  if (table === taxonomies) {
    const [row] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(and(eq(taxonomies.legacyId, id), eq(taxonomies.kind, kind as never)));
    return row?.id ?? null;
  }
  const [row] = await db.select({ id: itemBrands.id }).from(itemBrands).where(eq(itemBrands.legacyId, id));
  return row?.id ?? null;
}

const KNOWN_ITEM_COLS = new Set([
  "sys_id", "item_code", "model", "item_brand_id", "category_id", "sub_category_1_id",
  "sub_category_2_id", "series_id", "permission", "sort_order", "sell_price_currency",
  "sell_price_tier_0", "sell_price_tier_1", "sell_price_tier_2", "sell_price_tier_3",
  "sell_price_tier_4", "sell_price_tier_5", "default_cost_currency", "default_delivery_cost",
  "description", "key_specification",
]);

function numOrNull(v: string | undefined) {
  if (v == null || v.trim() === "") return null;
  const n = v.replace(/,/g, "");
  return Number.isFinite(Number(n)) ? n : null;
}

async function importItems() {
  const cp = await loadCheckpoint("items");
  let imported = 0;
  for (let id = cp.next; id <= MAX_ITEM_ID; id++) {
    const html = await getArchived(`/items/${id}/edit`, `items/${id}-edit`);
    if (html) {
      const { fields: f } = parseForm(html);
      if (f.sys_id) {
        const brandId = await resolveFk(itemBrands, f.item_brand_id);
        const categoryId = await resolveFk(taxonomies, f.category_id, "category");
        const sub1 = await resolveFk(taxonomies, f.sub_category_1_id, "sub_category_1");
        const sub2 = await resolveFk(taxonomies, f.sub_category_2_id, "sub_category_2");
        const series = await resolveFk(taxonomies, f.series_id, "series");
        const specs: Record<string, string> = {};
        for (const [k, v] of Object.entries(f)) if (!KNOWN_ITEM_COLS.has(k) && v) specs[k] = v;

        const values = {
          legacyId: id,
          sysId: f.sys_id,
          itemCode: f.item_code || null,
          model: f.model || null,
          brandId,
          categoryId,
          subCategory1Id: sub1,
          subCategory2Id: sub2,
          seriesId: series,
          permission: f.permission || null,
          sortOrder: f.sort_order ? Number(f.sort_order) : null,
          sellPriceCurrency: f.sell_price_currency || null,
          sellPriceTier0: numOrNull(f.sell_price_tier_0),
          sellPriceTier1: numOrNull(f.sell_price_tier_1),
          sellPriceTier2: numOrNull(f.sell_price_tier_2),
          sellPriceTier3: numOrNull(f.sell_price_tier_3),
          sellPriceTier4: numOrNull(f.sell_price_tier_4),
          sellPriceTier5: numOrNull(f.sell_price_tier_5),
          defaultCostCurrency: f.default_cost_currency || null,
          defaultDeliveryCost: numOrNull(f.default_delivery_cost),
          description: f.description || null,
          keySpecification: f.key_specification || null,
          specs,
        };
        const [row] = await db
          .insert(items)
          .values(values)
          .onConflictDoUpdate({ target: items.legacyId, set: values })
          .returning({ id: items.id });
        await importItemSubResources(id, row.id);
        imported++;
      }
    }
    if (id % 100 === 0) {
      await saveCheckpoint("items", id + 1);
      console.log(`  items: scanned ≤${id}, imported ${imported}`);
    }
  }
  await saveCheckpoint("items", MAX_ITEM_ID + 1);
  console.log(`  items: done, ${imported} imported`);
}

async function importItemSubResources(legacyItemId: number, itemId: number) {
  const buyHtml = await getArchived(`/items/${legacyItemId}/item_buy_prices`, `items/${legacyItemId}-buy`);
  if (buyHtml) {
    await db.delete(itemBuyPrices).where(eq(itemBuyPrices.itemId, itemId));
    for (const r of parseNameValueTable(buyHtml)) {
      const [currency, price] = r.value.split(/\s+/, 2);
      await db.insert(itemBuyPrices).values({
        itemId,
        name: r.name,
        price: numOrNull(price),
        currency: currency || null,
        isDefault: r.isDefault,
      });
    }
  }
  const costHtml = await getArchived(`/items/${legacyItemId}/item_cost_multis`, `items/${legacyItemId}-cost`);
  if (costHtml) {
    await db.delete(itemCostMultis).where(eq(itemCostMultis.itemId, itemId));
    for (const r of parseNameValueTable(costHtml)) {
      await db.insert(itemCostMultis).values({
        itemId,
        description: r.name,
        multiplier: numOrNull(r.value),
        isDefault: r.isDefault,
      });
    }
  }
}

/* ---------- customers ---------- */
/** Join the non-empty parts of a multi-line legacy field (office_address_1..3). */
const joinParts = (...vals: (string | undefined)[]) =>
  vals.map((v) => v?.trim()).filter(Boolean).join(", ") || null;

async function importCustomers() {
  const cp = await loadCheckpoint("customers");
  const userRows = await db.select({ id: users.id, legacyId: users.legacyId }).from(users);
  const userByLegacy = new Map(userRows.filter((u) => u.legacyId).map((u) => [u.legacyId!, u.id]));
  const branchRows = await db.select().from(branches);

  let imported = 0;
  for (let id = cp.next; id <= MAX_CUSTOMER_ID; id++) {
    const html = await getArchived(`/customers/${id}/edit`, `customers/${id}-edit`);
    if (html) {
      const { fields: f, selectedText, nested } = parseForm(html);
      if (f.cust_code) {
        // Legacy field names are prefixed (cust_company_name), the address is split
        // across three lines, and PICs are a nested collection.
        const picRows = (nested.customer_pics_attributes ?? []).filter(
          (p) => (p.pic_name ?? "").trim() !== "" && p._destroy !== "1",
        );
        const pics = picRows.map((p) => ({
          name: p.pic_name?.trim() ?? "",
          position: p.pic_position?.trim() || null,
          email: joinParts(p.pic_email_1, p.pic_email_2, p.pic_email_3),
          phone: joinParts(p.pic_phone_1, p.pic_phone_2, p.pic_phone_3),
        }));
        const primary = pics[0];
        const values = {
          legacyId: id,
          custCode: f.cust_code,
          companyName: f.cust_company_name || null,
          brand: f.cust_alias || null,
          groupName: f.cust_group_name || null,
          category: selectedText.cust_category_id || null,
          address: joinParts(f.office_address_1, f.office_address_2, f.office_address_3),
          picName: primary?.name ?? null,
          picPhone: primary?.phone ?? null,
          picEmail: primary?.email ?? null,
          pics,
          defaultSalesId: f.default_sales_id ? (userByLegacy.get(Number(f.default_sales_id)) ?? null) : null,
          branchId: matchBranch(branchRows, selectedText.branch_id ?? f.branch_id) ?? null,
        };
        await db
          .insert(customers)
          .values(values)
          .onConflictDoUpdate({ target: customers.legacyId, set: values });
        imported++;
      }
    }
    if (id % 100 === 0) {
      await saveCheckpoint("customers", id + 1);
      console.log(`  customers: scanned ≤${id}, imported ${imported}`);
    }
  }
  await saveCheckpoint("customers", MAX_CUSTOMER_ID + 1);
  console.log(`  customers: done, ${imported} imported`);
}

function matchBranch(rows: { id: number; name: string }[], nameOrId: string | undefined) {
  if (!nameOrId) return null;
  const byName = rows.find((b) => b.name === nameOrId.trim());
  return byName?.id ?? null;
}

async function main() {
  const only = process.argv[2]; // optional: reference | users | items | customers
  const sampleItemId = Number(process.env.SCRAPE_SAMPLE_ITEM_ID ?? 7497);
  console.log("Master scrape (READ-ONLY)…");
  try {
    if (!only || only === "reference") await importReference(sampleItemId);
    if (!only || only === "users") await importUsers();
    if (!only || only === "items") await importItems();
    if (!only || only === "customers") await importCustomers();
  } catch (e) {
    if (e instanceof StaleSessionError) console.error(`\n✗ ${e.message}`);
    else console.error(e);
    await pg.end();
    process.exit(1);
  }
  console.log("Done.");
  await pg.end();
}

main();
