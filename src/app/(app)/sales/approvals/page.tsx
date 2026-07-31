import Link from "next/link";
import { aliasedTable, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers, quotations, users } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SoBadge } from "@/components/so-actions";
import { soBadge } from "@/lib/so-workflow";
import { date } from "@/lib/format";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session?.isAdmin) return <Forbidden what="halaman approval (khusus admin)" />;

  const sales = aliasedTable(users, "sales");
  const rows = await db
    .select({
      id: quotations.id,
      qCode: quotations.qCode,
      subject: quotations.qSubject,
      company: quotations.companyName,
      soStatus: quotations.soStatus,
      submittedAt: quotations.soSubmittedAt,
      accurateSyncedAt: quotations.accurateSyncedAt,
      accurateSoNumber: quotations.accurateSoNumber,
      customer: customers.companyName,
      custCode: customers.custCode,
      salesName: sales.name,
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(sales, eq(quotations.salesId, sales.id))
    .where(inArray(quotations.soStatus, ["SUBMITTED", "APPROVED", "REJECTED"]))
    .orderBy(desc(quotations.soSubmittedAt))
    .limit(200);

  const waiting = rows.filter((r) => r.soStatus === "SUBMITTED");

  return (
    <div>
      <PageHeader
        title="Approval SO"
        subtitle={`${waiting.length} menunggu persetujuan · ${rows.length} total diajukan`}
      />
      <Table>
        <THead>
          <TR>
            <TH>SQ Code</TH>
            <TH>Customer</TH>
            <TH>Sales</TH>
            <TH>Company</TH>
            <TH>Diajukan</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-muted">
                Belum ada quotation yang diajukan menjadi SO.
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
              <TD className="max-w-xs truncate">{r.customer ?? r.custCode ?? "—"}</TD>
              <TD>{r.salesName ?? "—"}</TD>
              <TD>{r.company ?? "—"}</TD>
              <TD className="whitespace-nowrap">{date(r.submittedAt)}</TD>
              <TD>
                <SoBadge {...soBadge(r)} />
                {r.accurateSoNumber && (
                  <div className="mt-0.5 font-mono text-[10px] text-muted">{r.accurateSoNumber}</div>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
