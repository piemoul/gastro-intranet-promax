/**
 * READ-ONLY follow-up: codes don't match, so can we map our catalog to
 * Accurate's by NAME instead? Determines whether a mapping table is feasible.
 * GET requests only — nothing in Accurate is created or modified.
 *
 *   npx tsx scripts/accurate-name-match.ts [GASTRO|RSP|SARANA]
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";
import crypto from "node:crypto";
import { db, sql as pg } from "./_db";
import { customers, itemBrands, items } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const WMS_ENV = "/Users/user/Documents/coding disini/gastro-wms/.env";
if (existsSync(WMS_ENV)) config({ path: WMS_ENV });

const HOST = process.env.ACCURATE_HOST ?? "https://iris.accurate.id";
const KEY = process.env.ACCURATE_SIGNATURE_KEY ?? "";
const COMPANY_ID: Record<string, number> = { GASTRO: 1, RSP: 2, SARANA: 3 };

const tokenFor = (c: number) =>
  c === 1 ? process.env.ACCURATE_API_TOKEN
  : c === 2 ? process.env.ACCURATE_API_TOKEN_RSP
  : process.env.ACCURATE_API_TOKEN_SARANA;

function tsWIB() {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date())) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

async function get<T>(cid: number, path: string, params: Record<string, string | number>) {
  const ts = tsWIB();
  const sig = crypto.createHmac("sha256", KEY).update(ts).digest("base64");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${HOST}/accurate/api/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${tokenFor(cid)}`, "X-Api-Timestamp": ts, "X-Api-Signature": sig },
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok || j.s === false) throw new Error(`${path}: ${JSON.stringify(j.d ?? j).slice(0, 160)}`);
  return j as { d: T; sp?: { rowCount: number } };
}

/** Loose normalisation for fuzzy name comparison. */
const key = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Tokens of length >= 3, for overlap scoring. */
const tokens = (s: string) => new Set(key(s).split(" ").filter((t) => t.length >= 3));

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.min(a.size, b.size);
}

async function main() {
  const target = (process.argv[2] ?? "GASTRO").toUpperCase();
  const cid = COMPANY_ID[target];
  if (!cid) throw new Error(`Unknown company ${target}`);
  console.log(`=== NAME MATCHING vs Accurate ${target} (#${cid}) — READ ONLY ===\n`);

  // Accurate items (no + name)
  const accItems: { no: string; name: string; tok: Set<string> }[] = [];
  for (let page = 1; page <= 60; page++) {
    const r = await get<{ no?: string; name?: string }[]>(cid, "item/list.do", {
      fields: "no,name", "sp.pageSize": 100, "sp.page": page,
    });
    const rows = r.d ?? [];
    for (const it of rows) if (it.no && it.name) accItems.push({ no: it.no, name: it.name, tok: tokens(it.name) });
    if (rows.length < 100) break;
  }
  console.log(`Accurate items ter-fetch: ${accItems.length}`);
  console.log("Contoh nama item Accurate:");
  for (const a of accItems.slice(0, 5)) console.log(`  ${a.no}  ${a.name.slice(0, 70)}`);

  // Our items (brand + model + description)
  const ours = await db
    .select({ sysId: items.sysId, model: items.model, desc: items.description, brand: itemBrands.name })
    .from(items)
    .leftJoin(itemBrands, eq(items.brandId, itemBrands.id))
    .limit(300);
  console.log(`\nItem kita (sampel): ${ours.length}`);
  console.log("Contoh nama item kita:");
  for (const o of ours.slice(0, 5))
    console.log(`  ${o.sysId}  ${[o.brand, o.model, o.desc].filter(Boolean).join(" - ").slice(0, 70)}`);

  // Score each of ours against the best Accurate candidate.
  let exact = 0, strong = 0, weak = 0, none = 0;
  const examples: string[] = [];
  for (const o of ours) {
    const label = [o.brand, o.model, o.desc].filter(Boolean).join(" ");
    const t = tokens(label);
    let best = { score: 0, no: "", name: "" };
    for (const a of accItems) {
      const s = overlapScore(t, a.tok);
      if (s > best.score) best = { score: s, no: a.no, name: a.name };
    }
    if (best.score >= 0.99) exact++;
    else if (best.score >= 0.6) {
      strong++;
      if (examples.length < 5)
        examples.push(`  ${o.sysId} "${(o.model ?? "").slice(0, 26)}" -> ${best.no} "${best.name.slice(0, 40)}" (${best.score.toFixed(2)})`);
    } else if (best.score >= 0.3) weak++;
    else none++;
  }
  console.log(`\nHasil pencocokan nama item (${ours.length} sampel):`);
  console.log(`  sangat cocok (>=0.99) : ${exact}`);
  console.log(`  cocok kuat   (>=0.60) : ${strong}`);
  console.log(`  lemah        (>=0.30) : ${weak}`);
  console.log(`  tidak cocok  (<0.30)  : ${none}`);
  if (examples.length) {
    console.log("  contoh kandidat kuat:");
    for (const e of examples) console.log(e);
  }

  // Customers by name
  const accCust: { no: string; name: string; tok: Set<string> }[] = [];
  for (let page = 1; page <= 30; page++) {
    const r = await get<{ customerNo?: string; name?: string }[]>(cid, "customer/list.do", {
      fields: "customerNo,name", "sp.pageSize": 100, "sp.page": page,
    });
    const rows = r.d ?? [];
    for (const c of rows)
      if (c.customerNo && c.name) accCust.push({ no: c.customerNo, name: c.name, tok: tokens(c.name) });
    if (rows.length < 100) break;
  }
  const ourCust = await db
    .select({ code: customers.custCode, name: customers.companyName })
    .from(customers)
    .limit(200);
  let cExact = 0, cStrong = 0, cNone = 0;
  const cEx: string[] = [];
  for (const c of ourCust) {
    if (!c.name) continue;
    const t = tokens(c.name);
    let best = { score: 0, no: "", name: "" };
    for (const a of accCust) {
      const s = overlapScore(t, a.tok);
      if (s > best.score) best = { score: s, no: a.no, name: a.name };
    }
    if (best.score >= 0.99) cExact++;
    else if (best.score >= 0.6) {
      cStrong++;
      if (cEx.length < 5) cEx.push(`  "${(c.name ?? "").slice(0, 32)}" -> ${best.no} "${best.name.slice(0, 34)}" (${best.score.toFixed(2)})`);
    } else cNone++;
  }
  console.log(`\nHasil pencocokan nama customer (${ourCust.length} sampel, Accurate ${accCust.length}):`);
  console.log(`  sangat cocok : ${cExact}`);
  console.log(`  cocok kuat   : ${cStrong}`);
  console.log(`  tidak cocok  : ${cNone}`);
  for (const e of cEx) console.log(e);

  await pg.end();
  console.log("\nSelesai — GET saja, tidak ada perubahan di Accurate.");
}

main().catch(async (e) => {
  console.error("ERROR:", (e as Error).message);
  await pg.end();
  process.exit(1);
});
