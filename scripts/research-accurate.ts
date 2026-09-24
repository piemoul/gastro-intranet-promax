/** Bounded, GET-only production research. Never import WMS's writable client. */
import { config as loadDotenv } from "dotenv";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { getReadTransport, getConnectionStatus } from "../src/server/accurate/environment";
import type { ReadEndpoint } from "../src/server/accurate/transport";
import { row, number } from "../src/server/accurate/normalize";
async function main() {
loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });
if (!getConnectionStatus().some(company => company.configured)) throw new Error("Belum ada koneksi Accurate terkonfigurasi.");
const modules = { PO: "purchase-order", SQ: "sales-quotation", SO: "sales-order" } as const;
const end = new Date();
const start = new Date(end); start.setUTCDate(start.getUTCDate() - 90);
const format = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dir = join(process.cwd(), ".data", "research");
await mkdir(dir, { recursive: true, mode: 0o700 }); await chmod(dir, 0o700);
const read = getReadTransport();
const output: Record<string, unknown> = { capturedAt: end.toISOString(), start: format(start), end: format(end), method: "GET", limitPerDataset: 10, companies: {} };
const companies = output.companies as Record<string, unknown>;
for (const company of getConnectionStatus()) {
  if (!company.configured) { companies[company.companyId] = { error: "Kredensial belum tersedia" }; continue; }
  const datasets: Record<string, unknown> = {}; companies[company.companyId] = datasets;
  for (const [kind, resourceName] of Object.entries(modules)) {
    try {
      const listed = await read<unknown[]>(company.companyId, `${resourceName}/list.do` as ReadEndpoint, { fields: "id,number,transDate", "filter.transDate.op": "BETWEEN", "filter.transDate.val[0]": format(start), "filter.transDate.val[1]": format(end), "sp.pageSize": 10, "sp.page": 1, "sp.sort": "transDate|desc;id|desc" });
      const details: unknown[] = [];
      for (const entry of listed.d) { const id = number(row(entry).id); if (id) details.push((await read(company.companyId, `${resourceName}/detail.do` as ReadEndpoint, { id })).d); }
      const dataset: Record<string, unknown> = { paging: listed.sp, samples: details };
      if (details.length === 0 && kind === "SQ") {
        const expandedStart = new Date(end); expandedStart.setUTCDate(expandedStart.getUTCDate() - 365);
        const expanded = await read<unknown[]>(company.companyId, "sales-quotation/list.do", { fields: "id,number,transDate", "filter.transDate.op": "BETWEEN", "filter.transDate.val[0]": format(expandedStart), "filter.transDate.val[1]": format(end), "sp.pageSize": 10, "sp.page": 1, "sp.sort": "transDate|desc;id|desc" });
        const expandedDetails: unknown[] = [];
        for (const entry of expanded.d) { const id = number(row(entry).id); if (id) expandedDetails.push((await read(company.companyId, "sales-quotation/detail.do", { id })).d); }
        dataset.expandedCheck = { start: format(expandedStart), end: format(end), paging: expanded.sp, samples: expandedDetails };
      }
      datasets[kind] = dataset;
      console.log(`PT ${company.companyId} ${kind}: ${details.length} sampel terbaca`);
    } catch (error) { datasets[kind] = { error: error instanceof Error ? error.message : "Pembacaan gagal" }; console.log(`PT ${company.companyId} ${kind}: pembacaan belum berhasil`); }
  }
  for (const resourceName of ["item", "customer"] as const) {
    try {
      const listed = await read<unknown[]>(company.companyId, `${resourceName}/list.do`, { fields: "id", "sp.pageSize": resourceName === "item" ? 10 : 3, "sp.page": 1, "sp.sort": "id|desc" });
      const details: unknown[] = [];
      for (const entry of listed.d) { const id = number(row(entry).id); if (id) details.push((await read(company.companyId, `${resourceName}/detail.do`, { id })).d); }
      datasets[resourceName] = { paging: listed.sp, samples: details };
      console.log(`PT ${company.companyId} ${resourceName}: ${details.length} sampel terbaca`);
    } catch (error) { datasets[resourceName] = { error: error instanceof Error ? error.message : "Pembacaan gagal" }; console.log(`PT ${company.companyId} ${resourceName}: pembacaan belum berhasil`); }
  }
  await writeFile(join(dir, "accurate-sample.json"), JSON.stringify(output, null, 2), { mode: 0o600 });
}
await writeFile(join(dir, "accurate-sample.json"), JSON.stringify(output, null, 2), { mode: 0o600 });
console.log("Selesai. Sampel privat tersimpan di .data/research; tidak ada perubahan Accurate.");

}
main().catch(() => { console.error("Riset Accurate gagal; detail privat tidak ditampilkan."); process.exitCode = 1; });
