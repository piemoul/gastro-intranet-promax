import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { quotations, users } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function QuotationReportPage() {
  const [byStatus, byCompany, bySales, [totalRow]] = await Promise.all([
    db
      .select({ status: quotations.qStatus, n: count() })
      .from(quotations)
      .groupBy(quotations.qStatus)
      .orderBy(desc(count())),
    db
      .select({ company: quotations.companyName, n: count() })
      .from(quotations)
      .groupBy(quotations.companyName)
      .orderBy(desc(count())),
    db
      .select({ sales: users.name, n: count() })
      .from(quotations)
      .leftJoin(users, eq(quotations.salesId, users.id))
      .groupBy(users.name)
      .orderBy(desc(count()))
      .limit(15),
    db.select({ n: sql<number>`count(*)::int` }).from(quotations),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Quotation Report" subtitle="Ringkasan penawaran (menggantikan report lama yang error)" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Quotation" value={totalRow?.n ?? 0} />
        {byStatus.slice(0, 3).map((s) => (
          <Stat key={s.status ?? "—"} label={s.status ?? "(tanpa status)"} value={s.n} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Per Company</h2>
          <Table>
            <THead>
              <TR>
                <TH>Company</TH>
                <TH className="text-right">Jumlah</TH>
              </TR>
            </THead>
            <TBody>
              {byCompany.map((c) => (
                <TR key={c.company ?? "—"}>
                  <TD>{c.company ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{c.n}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Top Sales</h2>
          <Table>
            <THead>
              <TR>
                <TH>Sales</TH>
                <TH className="text-right">Jumlah</TH>
              </TR>
            </THead>
            <TBody>
              {bySales.map((s) => (
                <TR key={s.sales ?? "—"}>
                  <TD>{s.sales ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{s.n}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-bold tabular-nums text-brand">{value.toLocaleString("id-ID")}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
