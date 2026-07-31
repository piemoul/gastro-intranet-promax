import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { brandFields } from "@/server/forms/admin-fields";
import { saveBrand } from "@/server/actions/admin";

export default function NewBrandPage() {
  return (
    <div>
      <PageHeader title="Brand Baru" />
      <AutoForm fields={brandFields} action={saveBrand.bind(null, null)} cancelHref="/items/brands" />
    </div>
  );
}
