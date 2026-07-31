import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { taxonomyFields } from "@/server/forms/admin-fields";
import { saveTaxonomy } from "@/server/actions/admin";

export default function NewTaxonomyPage() {
  return (
    <div>
      <PageHeader title="Kategori Baru" subtitle="Category / Sub Category / Series" />
      <AutoForm
        fields={taxonomyFields}
        values={{ kind: "category" }}
        action={saveTaxonomy.bind(null, null)}
        cancelHref="/items/categories"
      />
    </div>
  );
}
