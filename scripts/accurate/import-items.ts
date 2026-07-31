/**
 * Replace the item catalog with Accurate's (READ-ONLY against Accurate).
 *
 * The legacy intranet used its own item codes (`04.AJA VCT-25`) which do not
 * exist in Accurate (`04.01.NEUM.00001`), so quotations could never be pushed.
 * Sourcing the catalog from Accurate makes `items.sys_id` the real Accurate
 * item no, which is exactly what `sales-quotation/save.do` needs.
 *
 *   npx tsx scripts/accurate/import-items.ts           # all companies
 *   npx tsx scripts/accurate/import-items.ts GASTRO    # one company
 *   npx tsx scripts/accurate/import-items.ts --keep    # don't wipe first
 */
import { inArray, isNotNull, sql } from "drizzle-orm";
import { db, sql as pg } from "../_db";
import { itemBuyPrices, itemCostMultis, items, quotationItems } from "@/server/db/schema";
import { accurateGet, COMPANY_ID } from "./client";

type AccItem = {
  id: number;
  no?: string;
  name?: string;
  itemTypeName?: string;
  itemType?: string;
  unit1Name?: string;
  unitPrice?: number;
  suspended?: boolean;
};

const CHUNK = 500;

async function wipeLegacyItems() {
  // quotation_items.item_id has no cascade — unlink first so the delete succeeds.
  const unlinked = await db
    .update(quotationItems)
    .set({ itemId: null })
    .where(isNotNull(quotationItems.itemId))
    .returning({ id: quotationItems.id });
  await db.delete(itemBuyPrices);
  await db.delete(itemCostMultis);
  const before = await db.select({ n: sql<number>`count(*)::int` }).from(items);
  await db.delete(items);
  console.log(
    `  wipe: ${before[0].n} item lama dihapus (${unlinked.length} baris quotation di-unlink, buy-prices & cost-multis ikut terhapus)`,
  );
}

async function importCompany(name: string, cid: number) {
  console.log(`\n=== ${name} (#${cid}) ===`);
  const rows: AccItem[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 300; page++) {
    const r = await accurateGet<AccItem[]>(cid, "item/list.do", {
      fields: "id,no,name,itemType,itemTypeName,unit1Name,unitPrice,suspended",
      "sp.pageSize": pageSize,
      "sp.page": page,
    });
    const batch = r.d ?? [];
    rows.push(...batch);
    if (page === 1) console.log(`  total di Accurate: ${r.sp?.rowCount ?? "?"}`);
    if (batch.length < pageSize) break;
  }
  const usable = rows.filter((r) => r.no);
  console.log(`  ter-fetch: ${rows.length} (dipakai ${usable.length})`);

  let written = 0;
  for (let i = 0; i < usable.length; i += CHUNK) {
    const values = usable.slice(i, i + CHUNK).map((r) => ({
      sysId: r.no!.trim(),
      accurateCompanyId: cid,
      accurateId: r.id,
      unitName: r.unit1Name ?? null,
      itemType: r.itemTypeName ?? r.itemType ?? null,
      suspended: Boolean(r.suspended),
      model: null,
      description: r.name ?? null,
      // Accurate keeps selling prices per price-category; unitPrice is the plain one.
      sellPriceCurrency: "IDR",
      sellPriceTier0: r.unitPrice != null && r.unitPrice > 0 ? String(r.unitPrice) : null,
      specs: {},
    }));
    await db
      .insert(items)
      .values(values)
      .onConflictDoUpdate({
        target: [items.accurateCompanyId, items.sysId],
        set: {
          accurateId: sql`excluded.accurate_id`,
          unitName: sql`excluded.unit_name`,
          itemType: sql`excluded.item_type`,
          suspended: sql`excluded.suspended`,
          description: sql`excluded.description`,
          sellPriceTier0: sql`excluded.sell_price_tier_0`,
          updatedAt: new Date(),
        },
      });
    written += values.length;
    process.stdout.write(`\r  tersimpan: ${written}/${usable.length}`);
  }
  console.log("");
  return written;
}

async function main() {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const only = args.find((a) => !a.startsWith("--"))?.toUpperCase();

  console.log("IMPORT ITEM DARI ACCURATE (Accurate: GET saja, tidak diubah)");
  if (!keep) await wipeLegacyItems();

  let total = 0;
  for (const [name, cid] of Object.entries(COMPANY_ID)) {
    if (only && only !== name) continue;
    try {
      total += await importCompany(name, cid);
    } catch (e) {
      console.error(`  GAGAL ${name}: ${(e as Error).message.slice(0, 160)}`);
    }
  }

  const [after] = await db.select({ n: sql<number>`count(*)::int` }).from(items);
  console.log(`\nSelesai. ${total} item diimpor · total di Neon: ${after.n}`);
  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
