import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { customerFields } from "@/server/forms/customer-fields";
import { updateCustomer } from "@/server/actions/customers";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Customer", "update"))) return <Forbidden what="perubahan customer" />;
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${c.custCode}`} subtitle={c.companyName ?? undefined} />
      <AutoForm
        fields={await customerFields()}
        values={c}
        action={updateCustomer.bind(null, customerId)}
        cancelHref={`/sales/customers/${customerId}`}
      />
    </div>
  );
}
