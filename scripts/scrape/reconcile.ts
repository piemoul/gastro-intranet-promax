/**
 * Post-scrape reconciliation report:  npm run scrape:reconcile
 * Row counts vs expected legacy volumes + basic integrity checks. Run after a
 * scrape to confirm parity before trusting the migrated data.
 */
import { isNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, sql as pg } from "../_db";
import {
  branches,
  customers,
  itemBrands,
  items,
  quotationItems,
  quotations,
  users,
} from "@/server/db/schema";

// Approx legacy volumes observed on the live system (from max ids / index counts).
const EXPECTED: Record<string, number> = {
  items: 7497,
  customers: 5891,
  quotations: 23121,
  users: 58,
  branches: 7,
  item_brands: 114,
};

async function n(t: PgTable): Promise<number> {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(t);
  return r?.c ?? 0;
}

async function main() {
  const counts: Record<string, number> = {
    items: await n(items),
    customers: await n(customers),
    quotations: await n(quotations),
    users: await n(users),
    branches: await n(branches),
    item_brands: await n(itemBrands),
  };

  console.log("=== Row counts (actual vs expected legacy) ===");
  for (const [k, expected] of Object.entries(EXPECTED)) {
    const got = counts[k] ?? 0;
    const pct = expected ? Math.round((got / expected) * 100) : 0;
    const flag = got >= expected ? "✓" : got >= expected * 0.98 ? "≈" : "⚠";
    console.log(`  ${k.padEnd(12)} ${String(got).padStart(6)} / ${expected} (${pct}%) ${flag}`);
  }

  console.log("\n=== Integrity spot-checks ===");
  const [orphanItems] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(items)
    .where(isNull(items.brandId));
  console.log(`  items without brand:      ${orphanItems.c}`);
  const [qNoCustomer] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(quotations)
    .where(isNull(quotations.customerId));
  console.log(`  quotations w/o customer:  ${qNoCustomer.c}`);
  const [qLines] = await db.select({ c: sql<number>`count(*)::int` }).from(quotationItems);
  console.log(`  quotation line items:     ${qLines.c}`);

  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
