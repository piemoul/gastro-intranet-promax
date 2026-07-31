/** Bukti: data customer berasal dari intranet lama, bukan dari Accurate. */
import { isNotNull, sql } from "drizzle-orm";
import { db, sql as pg } from "./_db";
import { customers, items } from "@/server/db/schema";

async function main() {
  const [c] = await db
    .select({
      total: sql<number>`count(*)::int`,
      dariLegacy: sql<number>`count(${customers.legacyId})::int`,
      punyaKodeAccurate: sql<number>`count(${customers.accurateCustomerNo})::int`,
      pernahSyncKeAccurate: sql<number>`count(${customers.accurateSyncedAt})::int`,
    })
    .from(customers);

  const [i] = await db
    .select({
      total: sql<number>`count(*)::int`,
      dariLegacy: sql<number>`count(${items.legacyId})::int`,
      dariAccurate: sql<number>`count(${items.accurateId})::int`,
    })
    .from(items);

  console.log("=== CUSTOMER (sumber: intranet lama) ===");
  console.log(`  total                  : ${c.total}`);
  console.log(`  punya legacy_id (lama) : ${c.dariLegacy}   <- semua dari intranet lama`);
  console.log(`  punya kode Accurate    : ${c.punyaKodeAccurate}   <- 0 = belum ada yang diambil/ditimpa dari Accurate`);
  console.log(`  pernah dikirim ke Accurate: ${c.pernahSyncKeAccurate}`);

  console.log("\n=== ITEM (sumber: Accurate, sesuai permintaan) ===");
  console.log(`  total                  : ${i.total}`);
  console.log(`  punya legacy_id (lama) : ${i.dariLegacy}   <- 0 = data lama sudah dibuang`);
  console.log(`  punya accurate_id      : ${i.dariAccurate}   <- semua dari Accurate`);

  const sample = await db
    .select({ code: customers.custCode, name: customers.companyName, accNo: customers.accurateCustomerNo })
    .from(customers)
    .where(isNotNull(customers.companyName))
    .limit(4);
  console.log("\n  contoh customer (kode & nama = format intranet lama):");
  for (const s of sample)
    console.log(`    ${s.code.padEnd(14)} ${(s.name ?? "").slice(0, 40).padEnd(42)} accurateNo=${s.accNo ?? "(kosong)"}`);

  await pg.end();
}
main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
