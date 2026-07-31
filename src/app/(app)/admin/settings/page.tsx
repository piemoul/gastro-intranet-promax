import Link from "next/link";
import { db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { RowActions } from "@/components/row-actions";
import { deleteSetting } from "@/server/actions/admin";

export default async function SettingsPage() {
  const rows = await db.select().from(settings).orderBy(settings.key);
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Kurs FX global & konfigurasi (di-snapshot ke tiap quotation baru)"
        action={
          <Link href="/admin/settings/new" className={buttonVariants()}>
            Setting Baru
          </Link>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Key</TH>
            <TH className="text-right">Nilai (Decimal)</TH>
            <TH>Nilai (String)</TH>
            <TH className="w-32" />
          </TR>
        </THead>
        <TBody>
          {rows.map((s) => (
            <TR key={s.id}>
              <TD className="font-mono text-xs text-brand-dark">{s.key}</TD>
              <TD className="text-right tabular-nums">{s.valueDecimal ?? "—"}</TD>
              <TD className="text-muted">{s.valueString ?? "—"}</TD>
              <TD>
                <RowActions
                  editHref={`/admin/settings/${s.id}/edit`}
                  remove={deleteSetting.bind(null, s.id)}
                  confirmText={`Hapus setting "${s.key}"?`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
