import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { itemFields } from "@/server/forms/item-fields";
import { createItem } from "@/server/actions/items";

export default async function NewItemPage() {
  if (!(await can("Item", "create"))) return <Forbidden what="pembuatan item" />;
  const fields = await itemFields();
  return (
    <div>
      <PageHeader title="Item Baru" subtitle="Tambah item ke katalog" />
      <AutoForm
        fields={fields}
        values={{ sellPriceCurrency: "USD", defaultCostCurrency: "USD" }}
        action={createItem}
        cancelHref="/items"
      />
    </div>
  );
}
