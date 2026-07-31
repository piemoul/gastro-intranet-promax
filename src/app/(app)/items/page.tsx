import Link from "next/link";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { itemBrands, items } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader, SearchBox } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await can("Item", "index"))) return <Forbidden what="Items" />;
  const { q } = await searchParams;
  const canCreate = await can("Item", "create");

  const where = q
    ? or(ilike(items.sysId, `%${q}%`), ilike(items.model, `%${q}%`), ilike(items.description, `%${q}%`))
    : undefined;

  const rows = await db
    .select({
      id: items.id,
      sysId: items.sysId,
      model: items.model,
      description: items.description,
      brand: itemBrands.name,
      currency: items.sellPriceCurrency,
      tier0: items.sellPriceTier0,
      updatedAt: items.updatedAt,
    })
    .from(items)
    .leftJoin(itemBrands, sql`${items.brandId} = ${itemBrands.id}`)
    .where(where)
    .orderBy(desc(items.updatedAt))
    .limit(200);

  return (
    <div>
      <PageHeader
        title="Items"
        subtitle="Katalog peralatan dapur komersial"
        action={
          canCreate ? (
            <Link href="/items/new" className={buttonVariants()}>
              Item Baru
            </Link>
          ) : undefined
        }
      />
      <SearchBox placeholder="Cari SYSID / model / deskripsi…" defaultValue={q ?? ""} />
      <Table>
        <THead>
          <TR>
            <TH>SYSID</TH>
            <TH>Model</TH>
            <TH>Brand</TH>
            <TH>Deskripsi</TH>
            <TH className="text-right">Tier 0</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={5} className="py-8 text-center text-muted">
                Belum ada data item. Jalankan <code className="text-brand">npm run scrape:master</code>.
              </TD>
            </TR>
          )}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-mono text-xs">
                <Link href={`/items/${r.id}`} className="text-brand hover:underline">
                  {r.sysId}
                </Link>
              </TD>
              <TD className="font-medium text-brand-dark">{r.model ?? "—"}</TD>
              <TD>{r.brand ?? "—"}</TD>
              <TD className="max-w-md truncate text-muted">{r.description ?? "—"}</TD>
              <TD className="text-right tabular-nums">
                {r.tier0 ? `${r.currency ?? ""} ${Number(r.tier0).toLocaleString("id-ID")}` : "—"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="mt-3 text-xs text-muted">Menampilkan maks. 200 baris.</p>
    </div>
  );
}
