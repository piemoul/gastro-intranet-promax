import { db } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function BranchesPage() {
  const rows = await db.select().from(branches).orderBy(branches.name);
  return (
    <div>
      <PageHeader title="Branches" subtitle="Cabang perusahaan" />
      <Table>
        <THead>
          <TR>
            <TH>Nama</TH>
            <TH>Alamat</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((b) => (
            <TR key={b.id}>
              <TD className="font-medium text-brand-dark">{b.name}</TD>
              <TD className="text-muted">{b.address ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
