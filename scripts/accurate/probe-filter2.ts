/** READ-ONLY: find a customer-lookup parameter that Accurate actually honours. */
import { accurateGet } from "./client";

const TARGET = "RT-0067"; // known to exist in GASTRO

const VARIANTS: { label: string; params: Record<string, string | number> }[] = [
  { label: "filter.customerNo.op=EQUAL + val", params: { "filter.customerNo.op": "EQUAL", "filter.customerNo.val": TARGET } },
  { label: "filter.customerNo.val (tanpa op)", params: { "filter.customerNo.val": TARGET } },
  { label: "filter.customerNo (langsung)", params: { "filter.customerNo": TARGET } },
  { label: "customerNo (param polos)", params: { customerNo: TARGET } },
  { label: "filter.name.op=CONTAIN + val", params: { "filter.name.op": "CONTAIN", "filter.name.val": "AURORA" } },
  { label: "filter.keywords.val", params: { "filter.keywords.val": TARGET } },
  { label: "sp.keyword", params: { "sp.keyword": TARGET } },
  { label: "keywords", params: { keywords: TARGET } },
];

async function main() {
  console.log(`Target: ${TARGET} (GASTRO). Baseline tanpa filter = 1938 baris.\n`);
  for (const v of VARIANTS) {
    try {
      const r = await accurateGet<{ customerNo?: string; name?: string }[]>(1, "customer/list.do", {
        fields: "id,customerNo,name",
        "sp.pageSize": 5,
        ...v.params,
      });
      const rows = r.d ?? [];
      const count = r.sp?.rowCount ?? -1;
      const works = count > 0 && count < 100;
      console.log(
        `${works ? "✓" : "·"} ${v.label.padEnd(38)} rowCount=${String(count).padStart(5)}  ${rows
          .slice(0, 2)
          .map((x) => x.customerNo)
          .join(", ")}`,
      );
    } catch (e) {
      console.log(`✗ ${v.label.padEnd(38)} ERROR: ${(e as Error).message.slice(0, 70)}`);
    }
  }
  console.log("\n(✓ = filter dihormati; · = diabaikan, mengembalikan semua)");
}
main();
