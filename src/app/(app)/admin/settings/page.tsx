import { db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function SettingsPage() {
  const rows = await db.select().from(settings).orderBy(settings.key);
  return (
    <div>
      <PageHeader title="Settings" subtitle="Kurs FX global & konfigurasi (di-snapshot ke tiap quotation)" />
      <Table>
        <THead>
          <TR>
            <TH>Key</TH>
            <TH className="text-right">Nilai (Decimal)</TH>
            <TH>Nilai (String)</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((s) => (
            <TR key={s.id}>
              <TD className="font-mono text-xs text-brand-dark">{s.key}</TD>
              <TD className="text-right tabular-nums">{s.valueDecimal ?? "—"}</TD>
              <TD className="text-muted">{s.valueString ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
