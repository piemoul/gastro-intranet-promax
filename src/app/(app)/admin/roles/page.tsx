import { db } from "@/server/db/client";
import { permissions } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function RolesPage() {
  const rows = await db
    .select()
    .from(permissions)
    .orderBy(permissions.department, permissions.model, permissions.action);

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Matriks izin baris-per-baris (department × level × Model::action × scope)"
      />
      <Table>
        <THead>
          <TR>
            <TH>Department</TH>
            <TH>Level (min–max)</TH>
            <TH>Model::Action</TH>
            <TH>Scope</TH>
            <TH>Field (source / dest)</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium text-brand-dark">{r.department}</TD>
              <TD className="whitespace-nowrap">
                {r.levelMin} <span className="text-muted">s/d</span> {r.levelMax}
              </TD>
              <TD className="font-mono text-xs">
                {r.model}::{r.action}
              </TD>
              <TD>
                <span className="inline-block rounded bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
                  {r.scope}
                </span>
              </TD>
              <TD className="font-mono text-xs text-muted">
                {r.sourceField && r.destField ? `${r.sourceField} / ${r.destField}` : "—"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="mt-3 text-xs text-muted">
        {rows.length} aturan (subset terverifikasi; set lengkap 56 aturan diimpor via scraper).
      </p>
    </div>
  );
}
