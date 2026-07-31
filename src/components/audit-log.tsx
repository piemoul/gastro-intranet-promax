import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditVersions } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { date } from "@/lib/format";

type Change = { field?: string; before?: string; after?: string };

export async function AuditLog({ model, title }: { model: string; title: string }) {
  const rows = await db
    .select()
    .from(auditVersions)
    .where(eq(auditVersions.model, model))
    .orderBy(desc(auditVersions.legacyCreatedAt))
    .limit(200);

  return (
    <div>
      <PageHeader title={title} subtitle={`Audit trail perubahan (${model})`} />
      <Table>
        <THead>
          <TR>
            <TH>Waktu</TH>
            <TH>User</TH>
            <TH>Changeset</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-8 text-center text-muted">
                Belum ada log. Diimpor via scraper, dan dicatat otomatis untuk perubahan baru.
              </TD>
            </TR>
          )}
          {rows.map((v) => (
            <TR key={v.id}>
              <TD className="whitespace-nowrap">{date(v.legacyCreatedAt)}</TD>
              <TD>{v.userLabel ?? "—"}</TD>
              <TD className="text-xs text-muted">
                {Array.isArray(v.changeset)
                  ? (v.changeset as Change[])
                      .map((c) => `${c.field}: ${c.before ?? "∅"} → ${c.after ?? "∅"}`)
                      .join("; ")
                  : "—"}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
