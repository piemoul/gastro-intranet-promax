import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { itemBrands } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { brandFields } from "@/server/forms/admin-fields";
import { saveBrand } from "@/server/actions/admin";

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brandId = Number(id);
  if (!Number.isFinite(brandId)) notFound();
  const [b] = await db.select().from(itemBrands).where(eq(itemBrands.id, brandId));
  if (!b) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${b.name}`} />
      <AutoForm fields={brandFields} values={b} action={saveBrand.bind(null, brandId)} cancelHref="/items/brands" />
    </div>
  );
}
