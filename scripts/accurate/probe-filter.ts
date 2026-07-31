/** READ-ONLY: does Accurate's customerNo EQUAL filter actually filter? */
import { accurateGet } from "./client";
import { db, sql as pg } from "../_db";
import { customers, quotations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [q] = await db.select().from(quotations).where(eq(quotations.id, 17));
  const [c] = q?.customerId
    ? await db.select().from(customers).where(eq(customers.id, q.customerId))
    : [];
  console.log("Quotation 17 -> customerId:", q?.customerId, "custCode:", c?.custCode, "| nama:", c?.companyName);

  const probe = c?.custCode ?? "HT 230001";
  console.log(`\n[1] Filter EQUAL dengan kode kita "${probe}" (harusnya TIDAK ketemu):`);
  const r1 = await accurateGet<{ id: number; customerNo?: string; name?: string }[]>(1, "customer/list.do", {
    fields: "id,customerNo,name",
    "filter.customerNo.op": "EQUAL",
    "filter.customerNo.val": probe,
    "sp.pageSize": 3,
  });
  console.log("   hasil:", (r1.d ?? []).map((x) => `${x.customerNo} (${x.name?.slice(0, 24)})`).join(" | ") || "(kosong)");
  console.log("   rowCount:", r1.sp?.rowCount);

  console.log(`\n[2] Filter EQUAL dengan kode yang PASTI ada "RT-0067" (harusnya ketemu 1):`);
  const r2 = await accurateGet<{ id: number; customerNo?: string; name?: string }[]>(1, "customer/list.do", {
    fields: "id,customerNo,name",
    "filter.customerNo.op": "EQUAL",
    "filter.customerNo.val": "RT-0067",
    "sp.pageSize": 3,
  });
  console.log("   hasil:", (r2.d ?? []).map((x) => `${x.customerNo} (${x.name?.slice(0, 24)})`).join(" | ") || "(kosong)");
  console.log("   rowCount:", r2.sp?.rowCount);

  console.log(`\n[3] Tanpa filter sama sekali (baseline, 3 pertama):`);
  const r3 = await accurateGet<{ id: number; customerNo?: string }[]>(1, "customer/list.do", {
    fields: "id,customerNo", "sp.pageSize": 3,
  });
  console.log("   hasil:", (r3.d ?? []).map((x) => x.customerNo).join(" | "));
  console.log("   rowCount:", r3.sp?.rowCount);

  console.log("\nKesimpulan: kalau [1] mengembalikan baris (apalagi sama dengan [3]), berarti filter DIABAIKAN — berbahaya.");
  await pg.end();
}
main().catch(async (e) => { console.error(e); await pg.end(); process.exit(1); });
