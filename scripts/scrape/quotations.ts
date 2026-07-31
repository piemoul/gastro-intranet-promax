/**
 * Quotation importer (READ-ONLY scrape → Neon). Run locally with LEGACY_COOKIE:
 *   npm run scrape:quotations
 *
 * Per id: fetch /quotations/:id/edit (39-field header) + /quotations/:id/items
 * (line items + FX snapshot). Idempotent upsert by legacy_id; resumable.
 */
import { eq } from "drizzle-orm";
import { db, sql as pg } from "../_db";
import { branches, customers, quotationItems, quotations, users } from "@/server/db/schema";
import { getArchived, StaleSessionError } from "./legacy-client";
import { parseForm } from "./parse";
import { loadCheckpoint, saveCheckpoint } from "./checkpoint";

const MAX_QUOTATION_ID = Number(process.env.SCRAPE_MAX_QUOTATION_ID ?? 23200);

const KNOWN_Q_COLS = new Set([
  "q_subject", "customer_pic", "q_rev", "q_date", "q_code", "company_name", "q_currency",
  "q_lang", "sales_id", "sales_admin_id", "branch_id", "q_type", "include_di_in_price",
  "round_idr_option", "q_status", "q_price_approval", "cat_internal", "franco", "delivery",
  "installation", "validity", "warranty", "payment", "ppn", "q_notes", "customer_id",
]);

function num(v: string | undefined) {
  if (!v || v.trim() === "") return null;
  const n = v.replace(/,/g, "");
  return Number.isFinite(Number(n)) ? n : null;
}

/** Parse the "USD_IDR: 18250.0 / EUR_USD: 1.15 / …" rates block from the items page. */
function parseFx(html: string) {
  const grab = (key: string) => {
    const m = html.match(new RegExp(`${key}\\s*:?\\s*([0-9.]+)`, "i"));
    return m ? m[1] : null;
  };
  return {
    fxUsdIdr: grab("USD_IDR"),
    fxEurUsd: grab("EUR_USD"),
    fxSgdUsd: grab("SGD_USD"),
    fxJpyUsd: grab("JPY_USD"),
    fxNzdUsd: grab("NZD_USD"),
    fxGbpUsd: grab("GBP_USD"),
    fxKrwUsd: grab("KRW_USD"),
    fxRmbUsd: grab("RMB_USD"),
    fxSekUsd: grab("SEK_USD"),
  };
}

async function main() {
  const cp = await loadCheckpoint("quotations");
  const [userRows, custRows, branchRows] = await Promise.all([
    db.select({ id: users.id, legacyId: users.legacyId }).from(users),
    db.select({ id: customers.id, legacyId: customers.legacyId }).from(customers),
    db.select().from(branches),
  ]);
  const userByLegacy = new Map(userRows.filter((u) => u.legacyId).map((u) => [u.legacyId!, u.id]));
  const custByLegacy = new Map(custRows.filter((c) => c.legacyId).map((c) => [c.legacyId!, c.id]));
  const branchByName = new Map(branchRows.map((b) => [b.name, b.id]));

  let imported = 0;
  console.log(`Quotation scrape (READ-ONLY) from id ${cp.next}…`);
  try {
    for (let id = cp.next; id <= MAX_QUOTATION_ID; id++) {
      const editHtml = await getArchived(`/quotations/${id}/edit`, `quotations/${id}-edit`);
      if (editHtml) {
        const { fields: f, selectedText } = parseForm(editHtml);
        if (f.q_code || f.q_subject) {
          const itemsHtml = await getArchived(`/quotations/${id}/items`, `quotations/${id}-items`);
          const fx = itemsHtml ? parseFx(itemsHtml) : {};
          const termsOthers: Record<string, string> = {};
          for (const [k, v] of Object.entries(f)) {
            if (!KNOWN_Q_COLS.has(k) && /_others$/.test(k) && v) termsOthers[k] = v;
          }

          const values = {
            legacyId: id,
            qCode: f.q_code || null,
            qRev: f.q_rev ? Number(f.q_rev) : 0,
            qDate: f.q_date || null,
            qSubject: f.q_subject || null,
            companyName: selectedText.company_name || f.company_name || null,
            qCurrency: selectedText.q_currency || f.q_currency || null,
            qLang: selectedText.q_lang || f.q_lang || null,
            qType: selectedText.q_type || f.q_type || null,
            qStatus: selectedText.q_status || f.q_status || null,
            qPriceApproval: f.q_price_approval || null,
            customerId: f.customer_id ? (custByLegacy.get(Number(f.customer_id)) ?? null) : null,
            customerPic: f.customer_pic || null,
            salesId: f.sales_id ? (userByLegacy.get(Number(f.sales_id)) ?? null) : null,
            salesAdminId: f.sales_admin_id ? (userByLegacy.get(Number(f.sales_admin_id)) ?? null) : null,
            branchId: branchByName.get((selectedText.branch_id ?? "").trim()) ?? null,
            includeDiInPrice: f.include_di_in_price === "1",
            roundIdrOption: f.round_idr_option === "1",
            franco: selectedText.franco || f.franco || null,
            delivery: selectedText.delivery || f.delivery || null,
            installation: selectedText.installation || f.installation || null,
            validity: selectedText.validity || f.validity || null,
            warranty: selectedText.warranty || f.warranty || null,
            payment: selectedText.payment || f.payment || null,
            ppn: selectedText.ppn || f.ppn || null,
            termsOthers,
            qNotes: f.q_notes || null,
            catInternal: f.cat_internal || null,
            ...fx,
          };

          const [row] = await db
            .insert(quotations)
            .values(values)
            .onConflictDoUpdate({ target: quotations.legacyId, set: values })
            .returning({ id: quotations.id });

          // Line items (Rails nested quotation_items_attributes).
          const { nested } = parseForm(itemsHtml || editHtml);
          const lines = nested.quotation_items_attributes ?? [];
          await db.delete(quotationItems).where(eq(quotationItems.quotationId, row.id));
          let lineNo = 0;
          for (const ln of lines) {
            if (!ln.item && !ln.item_price) continue;
            await db.insert(quotationItems).values({
              quotationId: row.id,
              lineNo: lineNo++,
              itemLabel: ln.item || null,
              qty: num(ln.item_qty),
              currency: ln.item_currency || null,
              price: num(ln.item_price),
              deliveryCost: num(ln.item_delivery_cost),
              installCost: num(ln.item_install_cost),
              remarks: ln.remarks || null,
            });
          }
          imported++;
        }
      }
      if (id % 50 === 0) {
        await saveCheckpoint("quotations", id + 1);
        console.log(`  quotations: scanned ≤${id}, imported ${imported}`);
      }
    }
    await saveCheckpoint("quotations", MAX_QUOTATION_ID + 1);
  } catch (e) {
    if (e instanceof StaleSessionError) console.error(`\n✗ ${e.message}`);
    else console.error(e);
    await pg.end();
    process.exit(1);
  }
  console.log(`Done. ${imported} quotations imported.`);
  await pg.end();
}

main();
