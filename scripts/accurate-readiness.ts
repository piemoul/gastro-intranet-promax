/**
 * READ-ONLY readiness check: can our quotations be pushed to Accurate Online as
 * Sales Quotations (`sales-quotation/save.do`)?
 *
 * Accurate requires only three things per the API docs:
 *   customerNo, detailItem[n].itemNo, detailItem[n].unitPrice
 * …so the real question is whether our `customers.cust_code` and `items.sys_id`
 * actually MATCH Accurate's customerNo / item no.
 *
 * This script issues **GET requests only** — it never creates or modifies
 * anything in Accurate. Credentials are read from the gastro-wms .env.
 *
 *   npx tsx scripts/accurate-readiness.ts
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";
import crypto from "node:crypto";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, sql as pg } from "./_db";
import { customers, items, quotationItems, quotations } from "@/server/db/schema";

// Accurate credentials live in the sibling WMS project.
const WMS_ENV = "/Users/user/Documents/coding disini/gastro-wms/.env";
if (existsSync(WMS_ENV)) config({ path: WMS_ENV });

const HOST = process.env.ACCURATE_HOST ?? "https://iris.accurate.id";
const SIGNATURE_KEY = process.env.ACCURATE_SIGNATURE_KEY ?? "";

/** companyName in our data → Accurate company id (per gastro-wms client.ts). */
const COMPANY_ID: Record<string, number> = { GASTRO: 1, RSP: 2, SARANA: 3 };

function tokenFor(companyId: number): string | undefined {
  return companyId === 1
    ? process.env.ACCURATE_API_TOKEN
    : companyId === 2
      ? process.env.ACCURATE_API_TOKEN_RSP
      : companyId === 3
        ? process.env.ACCURATE_API_TOKEN_SARANA
        : undefined;
}

function timestampWIB(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** GET only. There is deliberately no post/delete helper in this script. */
async function accurateGet<T>(
  companyId: number,
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ s: boolean; d: T; sp?: { rowCount: number } }> {
  const token = tokenFor(companyId);
  if (!token) throw new Error(`No Accurate token for company #${companyId}`);
  const ts = timestampWIB();
  const signature = crypto.createHmac("sha256", SIGNATURE_KEY).update(ts).digest("base64");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${HOST}/accurate/api/${path}?${qs}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "X-Api-Timestamp": ts, "X-Api-Signature": signature },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || json.s === false) {
    throw new Error(`Accurate ${path}: ${JSON.stringify(json.d ?? json).slice(0, 200)}`);
  }
  return json;
}

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

async function main() {
  console.log("=".repeat(78));
  console.log("ACCURATE SALES QUOTATION READINESS — READ ONLY (GET requests only)");
  console.log("=".repeat(78));

  /* ---------- 1. What our quotations look like ---------- */
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withCustomer: sql<number>`count(*) filter (where ${quotations.customerId} is not null)::int`,
      withCompany: sql<number>`count(*) filter (where ${quotations.companyName} is not null)::int`,
    })
    .from(quotations);
  const [lineStats] = await db
    .select({
      lines: sql<number>`count(*)::int`,
      withItemId: sql<number>`count(*) filter (where ${quotationItems.itemId} is not null)::int`,
      withPrice: sql<number>`count(*) filter (where ${quotationItems.price} is not null)::int`,
      withQty: sql<number>`count(*) filter (where ${quotationItems.qty} is not null)::int`,
    })
    .from(quotationItems);

  console.log("\n[1] DATA KITA (Neon)");
  console.log(`  quotations           : ${totals.total}`);
  console.log(`    punya customer FK  : ${totals.withCustomer}`);
  console.log(`    punya company      : ${totals.withCompany}`);
  console.log(`  line items           : ${lineStats.lines}`);
  console.log(`    ter-link ke item FK: ${lineStats.withItemId}  <-- kunci utk itemNo`);
  console.log(`    punya harga        : ${lineStats.withPrice}`);
  console.log(`    punya qty          : ${lineStats.withQty}`);

  /* ---------- 2. Can we reach Accurate? ---------- */
  console.log("\n[2] KONEKSI ACCURATE (read-only)");
  const reachable: Record<string, number> = {};
  for (const [name, cid] of Object.entries(COMPANY_ID)) {
    if (!tokenFor(cid)) {
      console.log(`  ${name.padEnd(7)} (#${cid}) : token TIDAK ada — dilewati`);
      continue;
    }
    try {
      const r = await accurateGet<{ id: number }[]>(cid, "customer/list.do", {
        fields: "id", "sp.pageSize": 1,
      });
      const n = r.sp?.rowCount ?? 0;
      reachable[name] = cid;
      console.log(`  ${name.padEnd(7)} (#${cid}) : OK — ${n} customer di Accurate`);
    } catch (e) {
      console.log(`  ${name.padEnd(7)} (#${cid}) : GAGAL — ${(e as Error).message.slice(0, 90)}`);
    }
  }
  if (Object.keys(reachable).length === 0) {
    console.log("\n  Tidak ada koneksi Accurate yang bisa dipakai. Berhenti.");
    await pg.end();
    return;
  }

  /* ---------- 3. Do our codes match Accurate's? ---------- */
  for (const [name, cid] of Object.entries(reachable)) {
    console.log(`\n[3] PENCOCOKAN KODE — ${name} (#${cid})`);

    // Pull Accurate master lists (read-only).
    const accCustomers = new Map<string, string>();
    for (let page = 1; page <= 20; page++) {
      const r = await accurateGet<{ customerNo?: string; name?: string }[]>(cid, "customer/list.do", {
        fields: "customerNo,name", "sp.pageSize": 100, "sp.page": page,
      });
      const rows = r.d ?? [];
      for (const c of rows) if (c.customerNo) accCustomers.set(norm(c.customerNo), c.name ?? "");
      if (rows.length < 100) break;
    }
    const accItems = new Map<string, string>();
    for (let page = 1; page <= 40; page++) {
      const r = await accurateGet<{ no?: string; name?: string }[]>(cid, "item/list.do", {
        fields: "no,name", "sp.pageSize": 100, "sp.page": page,
      });
      const rows = r.d ?? [];
      for (const it of rows) if (it.no) accItems.set(norm(it.no), it.name ?? "");
      if (rows.length < 100) break;
    }
    console.log(`  Accurate: ${accCustomers.size} customer, ${accItems.size} item (sampel ter-fetch)`);

    // Compare against ours.
    const ourCustomers = await db
      .select({ code: customers.custCode, name: customers.companyName })
      .from(customers)
      .limit(500);
    const custHit = ourCustomers.filter((c) => accCustomers.has(norm(c.code)));
    console.log(
      `  customers cocok : ${custHit.length}/${ourCustomers.length}` +
        ` (${ourCustomers.length ? Math.round((custHit.length / ourCustomers.length) * 100) : 0}%)`,
    );
    if (custHit.length) console.log(`    contoh cocok  : ${custHit.slice(0, 3).map((c) => c.code).join(", ")}`);
    const custMiss = ourCustomers.filter((c) => !accCustomers.has(norm(c.code))).slice(0, 3);
    if (custMiss.length) console.log(`    contoh beda   : ${custMiss.map((c) => c.code).join(", ")}`);

    const ourItems = await db.select({ sysId: items.sysId, model: items.model }).from(items).limit(500);
    const itemHit = ourItems.filter((i) => accItems.has(norm(i.sysId)));
    console.log(
      `  items cocok     : ${itemHit.length}/${ourItems.length}` +
        ` (${ourItems.length ? Math.round((itemHit.length / ourItems.length) * 100) : 0}%)`,
    );
    if (itemHit.length) console.log(`    contoh cocok  : ${itemHit.slice(0, 3).map((i) => i.sysId).join(", ")}`);
    const itemMiss = ourItems.filter((i) => !accItems.has(norm(i.sysId))).slice(0, 3);
    if (itemMiss.length) console.log(`    contoh beda   : ${itemMiss.map((i) => i.sysId).join(", ")}`);

    // Show a couple of Accurate codes so we can eyeball the format difference.
    console.log(`    format Accurate customerNo: ${[...accCustomers.keys()].slice(0, 3).join(" | ")}`);
    console.log(`    format Accurate itemNo    : ${[...accItems.keys()].slice(0, 3).join(" | ")}`);
  }

  await pg.end();
  console.log("\nSelesai. Tidak ada data Accurate yang diubah (GET saja).");
}

main().catch(async (e) => {
  console.error("\nERROR:", (e as Error).message);
  await pg.end();
  process.exit(1);
});
