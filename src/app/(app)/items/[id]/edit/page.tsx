import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { itemFields } from "@/server/forms/item-fields";
import { updateItem } from "@/server/actions/items";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Item", "update"))) return <Forbidden what="perubahan item" />;
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) notFound();

  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  if (!item) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${item.sysId}`} subtitle={item.model ?? undefined} />
      <AutoForm
        fields={await itemFields()}
        values={item}
        action={updateItem.bind(null, itemId)}
        cancelHref={`/items/${itemId}`}
      />
    </div>
  );
}
