import { db } from "@/server/db/client";
import { taxonomies } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TAXONOMY_KINDS } from "@/lib/constants";

const KIND_LABEL: Record<string, string> = {
  category: "Category",
  sub_category_1: "Sub Category 1",
  sub_category_2: "Sub Category 2",
  series: "Series",
};

export default async function ItemCategoriesPage() {
  const rows = await db.select().from(taxonomies).orderBy(taxonomies.kind, taxonomies.name);
  const byKind = Object.fromEntries(
    TAXONOMY_KINDS.map((k) => [k, rows.filter((r) => r.kind === k)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Item Categories" subtitle="Taksonomi katalog (category → sub → series)" />
      {rows.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted">
          Belum ada taksonomi. Jalankan <code className="text-brand">npm run scrape:master</code>.
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {TAXONOMY_KINDS.map((k) => (
          <div key={k}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">
              {KIND_LABEL[k]} <span className="text-muted">({byKind[k].length})</span>
            </h2>
            <Table>
              <THead>
                <TR>
                  <TH>Nama</TH>
                </TR>
              </THead>
              <TBody>
                {byKind[k].slice(0, 50).map((t) => (
                  <TR key={t.id}>
                    <TD>{t.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
