import Link from "next/link";
import { aliasedTable, and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers, quotations, users } from "@/server/db/schema";
import { can, scopeWhere } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader, SearchBox } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { date } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-brand text-white",
  INTERNAL: "border border-border text-brand-dark",
  DRAFT: "bg-neutral-200 text-neutral-700",
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await can("Quotation", "index"))) return <Forbidden what="Quotations" />;
  const { q } = await searchParams;
  const canCreate = await can("Quotation", "create");

  const sales = aliasedTable(users, "sales");
  const scope = await scopeWhere("Quotation", "index");
  const search = q
    ? or(ilike(quotations.qCode, `%${q}%`), ilike(quotations.qSubject, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: quotations.id,
      qCode: quotations.qCode,
      subject: quotations.qSubject,
      company: quotations.companyName,
      status: quotations.qStatus,
      qDate: quotations.qDate,
      customer: customers.companyName,
      salesName: sales.name,
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(sales, eq(quotations.salesId, sales.id))
    .where(and(scope, search))
    .orderBy(desc(quotations.qDate))
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Kelola penawaran (difilter sesuai izin Anda)"
        action={
          canCreate ? (
            <Link href="/sales/quotations/new" className={buttonVariants()}>
              Quotation Baru
            </Link>
          ) : undefined
        }
      />
      <SearchBox placeholder="Cari kode / subjek…" defaultValue={q ?? ""} />
      <Table>
        <THead>
          <TR>
            <TH>Code</TH>
            <TH>Company</TH>
            <TH>Customer</TH>
            <TH>Sales</TH>
            <TH>Tanggal</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-muted">
                Belum ada quotation. Jalankan <code className="text-brand">npm run scrape:quotations</code>.
              </TD>
            </TR>
          )}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>
                <Link href={`/sales/quotations/${r.id}`} className="font-mono text-xs text-brand hover:underline">
                  {r.qCode ?? `#${r.id}`}
                </Link>
              </TD>
              <TD>{r.company ?? "—"}</TD>
              <TD className="max-w-xs truncate">{r.customer ?? "—"}</TD>
              <TD>{r.salesName ?? "—"}</TD>
              <TD className="whitespace-nowrap">{date(r.qDate)}</TD>
              <TD>
                {r.status && (
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-600"}`}
                  >
                    {r.status}
                  </span>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
