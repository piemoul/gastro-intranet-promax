import Link from "next/link";
import { notFound } from "next/navigation";
import { aliasedTable, desc, eq } from "drizzle-orm";
import { Pencil, Trash2 } from "lucide-react";
import { db } from "@/server/db/client";
import { branches, customers, quotations, users } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { deleteCustomer } from "@/server/actions/customers";
import { date } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Customer", "show"))) return <Forbidden what="customer ini" />;
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const sales = aliasedTable(users, "sales");
  const [row] = await db
    .select({ c: customers, salesName: sales.name, branch: branches.name })
    .from(customers)
    .leftJoin(sales, eq(customers.defaultSalesId, sales.id))
    .leftJoin(branches, eq(customers.branchId, branches.id))
    .where(eq(customers.id, customerId));
  if (!row) notFound();
  const c = row.c;

  const [quos, canEdit, canDelete] = await Promise.all([
    db
      .select({ id: quotations.id, qCode: quotations.qCode, subject: quotations.qSubject, status: quotations.qStatus, qDate: quotations.qDate })
      .from(quotations)
      .where(eq(quotations.customerId, customerId))
      .orderBy(desc(quotations.qDate))
      .limit(50),
    can("Customer", "update"),
    can("Customer", "destroy"),
  ]);

  const info: [string, string | null][] = [
    ["Group", c.groupName],
    ["Kategori", c.category],
    ["Brand", c.brand],
    ["Default Sales", row.salesName],
    ["Branch", row.branch],
    ["PIC", c.picName],
    ["Telepon", c.picPhone],
    ["Email", c.picEmail],
    ["Alamat", c.address],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.companyName ?? c.custCode}
        subtitle={c.custCode}
        action={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link
                href={`/sales/customers/${customerId}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Pencil /> Edit
              </Link>
            )}
            {canDelete && (
              <form action={deleteCustomer.bind(null, customerId)}>
                <button type="submit" className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}>
                  <Trash2 /> Hapus
                </button>
              </form>
            )}
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card p-5">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
              <dd className="mt-0.5 font-medium text-brand-dark">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">
          Quotations ({quos.length})
        </h2>
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Subjek</TH>
              <TH>Tanggal</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {quos.length === 0 && (
              <TR>
                <TD colSpan={4} className="py-6 text-center text-muted">
                  Belum ada quotation untuk customer ini.
                </TD>
              </TR>
            )}
            {quos.map((q) => (
              <TR key={q.id}>
                <TD>
                  <Link href={`/sales/quotations/${q.id}`} className="font-mono text-xs text-brand hover:underline">
                    {q.qCode ?? `#${q.id}`}
                  </Link>
                </TD>
                <TD className="max-w-md truncate">{q.subject ?? "—"}</TD>
                <TD className="whitespace-nowrap">{date(q.qDate)}</TD>
                <TD>{q.status ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
