import Link from "next/link";
import { db } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { RowActions } from "@/components/row-actions";
import { deleteBranch } from "@/server/actions/admin";

export default async function BranchesPage() {
  const rows = await db.select().from(branches).orderBy(branches.name);
  return (
    <div>
      <PageHeader
        title="Branches"
        subtitle="Cabang perusahaan"
        action={
          <Link href="/admin/branches/new" className={buttonVariants()}>
            Branch Baru
          </Link>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Nama</TH>
            <TH>Alamat</TH>
            <TH className="w-32" />
          </TR>
        </THead>
        <TBody>
          {rows.map((b) => (
            <TR key={b.id}>
              <TD className="font-medium text-brand-dark">{b.name}</TD>
              <TD className="text-muted">{b.address ?? "—"}</TD>
              <TD>
                <RowActions
                  editHref={`/admin/branches/${b.id}/edit`}
                  remove={deleteBranch.bind(null, b.id)}
                  confirmText={`Hapus branch "${b.name}"?`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
