import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { taxonomies } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { taxonomyFields } from "@/server/forms/admin-fields";
import { saveTaxonomy } from "@/server/actions/admin";

export default async function EditTaxonomyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taxId = Number(id);
  if (!Number.isFinite(taxId)) notFound();
  const [t] = await db.select().from(taxonomies).where(eq(taxonomies.id, taxId));
  if (!t) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${t.name}`} subtitle={t.kind} />
      <AutoForm
        fields={taxonomyFields}
        values={t}
        action={saveTaxonomy.bind(null, taxId)}
        cancelHref="/items/categories"
      />
    </div>
  );
}
