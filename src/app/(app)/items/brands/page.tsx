import Link from "next/link";
import { db } from "@/server/db/client";
import { itemBrands } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { RowActions } from "@/components/row-actions";
import { deleteBrand } from "@/server/actions/admin";

export default async function ItemBrandsPage() {
  const rows = await db.select().from(itemBrands).orderBy(itemBrands.name);
  return (
    <div>
      <PageHeader
        title="Item Brands"
        subtitle={`${rows.length} brand`}
        action={
          <Link href="/items/brands/new" className={buttonVariants()}>
            Brand Baru
          </Link>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Brand</TH>
            <TH className="w-32" />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={2} className="py-8 text-center text-muted">
                Belum ada brand. Jalankan <code className="text-brand">npm run scrape:master</code>.
              </TD>
            </TR>
          )}
          {rows.map((b) => (
            <TR key={b.id}>
              <TD className="font-medium text-brand-dark">{b.name}</TD>
              <TD>
                <RowActions
                  editHref={`/items/brands/${b.id}/edit`}
                  remove={deleteBrand.bind(null, b.id)}
                  confirmText={`Hapus brand "${b.name}"?`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
