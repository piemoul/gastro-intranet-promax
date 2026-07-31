/** READ-ONLY: what fields did we actually capture, and is an Accurate code hiding in them? */
import { sql } from "drizzle-orm";
import { db, sql as pg } from "./_db";
import { customers, items } from "@/server/db/schema";

async function main() {
  // All distinct spec keys across scraped items (the ~45 extra fields).
  const specKeys = (await db.execute(sql`
    select k, count(*)::int as n
    from ${items}, lateral jsonb_object_keys(${items.specs}) as k
    group by k order by n desc limit 40`)) as unknown as { k: string; n: number }[];
  console.log("=== SPEC KEYS pada item (dari scrape) ===");
  for (const r of specKeys) console.log(`  ${r.k.padEnd(34)} ${r.n}`);

  // Any key that smells like an Accurate reference?
  console.log("\n=== KEY yang mirip referensi Accurate ===");
  const suspicious = specKeys.filter((r) => /acc|sku|no$|code|kode|erp/i.test(r.k));
  console.log(suspicious.length ? suspicious.map((r) => r.k).join(", ") : "  (tidak ada)");

  // Item column fill rates.
  const [ic] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withCode: sql<number>`count(${items.itemCode})::int`,
      withModel: sql<number>`count(${items.model})::int`,
      withDesc: sql<number>`count(${items.description})::int`,
    })
    .from(items);
  console.log("\n=== KELENGKAPAN KOLOM ITEM ===");
  console.log(`  total ${ic.total} | item_code ${ic.withCode} | model ${ic.withModel} | description ${ic.withDesc}`);

  const sampleCodes = await db
    .select({ sysId: items.sysId, itemCode: items.itemCode })
    .from(items)
    .where(sql`${items.itemCode} is not null and ${items.itemCode} <> ''`)
    .limit(8);
  console.log("  contoh item_code (kandidat kode Accurate?):");
  for (const s of sampleCodes) console.log(`    ${s.sysId.padEnd(22)} -> ${s.itemCode}`);
  if (!sampleCodes.length) console.log("    (item_code kosong semua)");

  // Customer column fill rates.
  const [cc] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withCompany: sql<number>`count(${customers.companyName})::int`,
      withGroup: sql<number>`count(${customers.groupName})::int`,
      withPic: sql<number>`count(${customers.picName})::int`,
      withAddr: sql<number>`count(${customers.address})::int`,
    })
    .from(customers);
  console.log("\n=== KELENGKAPAN KOLOM CUSTOMER ===");
  console.log(
    `  total ${cc.total} | company_name ${cc.withCompany} | group ${cc.withGroup} | pic ${cc.withPic} | address ${cc.withAddr}`,
  );
  const cs = await db.select().from(customers).limit(3);
  for (const c of cs)
    console.log(`    ${c.custCode} | company=${c.companyName ?? "NULL"} | brand=${c.brand ?? "NULL"} | group=${c.groupName ?? "NULL"}`);

  await pg.end();
}
main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
