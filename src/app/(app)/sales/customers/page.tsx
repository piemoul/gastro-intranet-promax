import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches, customers, users } from "@/server/db/schema";
import { can, scopeWhere } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader, SearchBox } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await can("Customer", "index"))) return <Forbidden what="Customers" />;
  const { q } = await searchParams;
  const canCreate = await can("Customer", "create");

  const scope = await scopeWhere("Customer", "index");
  const search = q
    ? or(
        ilike(customers.custCode, `%${q}%`),
        ilike(customers.companyName, `%${q}%`),
        ilike(customers.groupName, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: customers.id,
      custCode: customers.custCode,
      companyName: customers.companyName,
      groupName: customers.groupName,
      category: customers.category,
      sales: users.name,
      branch: branches.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.defaultSalesId, users.id))
    .leftJoin(branches, eq(customers.branchId, branches.id))
    .where(and(scope, search))
    .orderBy(desc(customers.updatedAt))
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Daftar pelanggan (difilter sesuai izin Anda)"
        action={
          canCreate ? (
            <Link href="/sales/customers/new" className={buttonVariants()}>
              Customer Baru
            </Link>
          ) : undefined
        }
      />
      <SearchBox placeholder="Cari kode / perusahaan / group…" defaultValue={q ?? ""} />
      <Table>
        <THead>
          <TR>
            <TH>Code</TH>
            <TH>Perusahaan</TH>
            <TH>Group</TH>
            <TH>Kategori</TH>
            <TH>Branch</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={5} className="py-8 text-center text-muted">
                Belum ada data customer. Jalankan <code className="text-brand">npm run scrape:master</code>.
              </TD>
            </TR>
          )}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-mono text-xs">
                <Link href={`/sales/customers/${r.id}`} className="text-brand hover:underline">
                  {r.custCode}
                </Link>
              </TD>
              <TD className="font-medium text-brand-dark">{r.companyName ?? "—"}</TD>
              <TD>{r.groupName ?? "—"}</TD>
              <TD>{r.category ?? "—"}</TD>
              <TD>{r.branch ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
