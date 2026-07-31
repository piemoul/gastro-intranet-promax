/** READ-ONLY: what does an Accurate item record actually contain? */
import { accurateGet, COMPANY_ID } from "./client";

async function main() {
  for (const [name, cid] of Object.entries(COMPANY_ID)) {
    try {
      const list = await accurateGet<{ id: number; no: string; name: string }[]>(cid, "item/list.do", {
        fields: "id,no,name", "sp.pageSize": 1,
      });
      const first = list.d?.[0];
      console.log(`\n=== ${name} (#${cid}) — total ${list.sp?.rowCount ?? "?"} item ===`);
      if (!first) continue;
      const detail = await accurateGet<Record<string, unknown>>(cid, "item/detail.do", { id: first.id });
      const d = detail.d ?? {};
      const interesting = [
        "id", "no", "name", "itemType", "itemTypeName", "unit1Name", "unitPrice",
        "vendorPrice", "shortName", "notes", "suspended", "manageSN", "serialNumberType",
        "itemCategory", "brand", "upcNo",
      ];
      for (const k of interesting) {
        if (k in d) {
          const v = d[k];
          const shown = typeof v === "object" && v !== null
            ? JSON.stringify(v).slice(0, 70)
            : String(v).slice(0, 70);
          console.log(`  ${k.padEnd(18)} = ${shown}`);
        }
      }
      // Which price fields exist at all?
      const priceKeys = Object.keys(d).filter((k) => /price|harga|cost/i.test(k));
      console.log(`  price-ish keys: ${priceKeys.join(", ") || "(none)"}`);
      // detailSellingPrice / multi-level price?
      if (Array.isArray((d as any).detailSellingPrice)) {
        console.log(`  detailSellingPrice: ${JSON.stringify((d as any).detailSellingPrice).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`\n=== ${name} (#${cid}) GAGAL: ${(e as Error).message.slice(0, 120)}`);
    }
  }
}
main();
