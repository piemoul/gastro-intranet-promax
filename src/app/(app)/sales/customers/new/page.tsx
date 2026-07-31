import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { customerFields } from "@/server/forms/customer-fields";
import { createCustomer } from "@/server/actions/customers";

export default async function NewCustomerPage() {
  if (!(await can("Customer", "create"))) return <Forbidden what="pembuatan customer" />;
  return (
    <div>
      <PageHeader title="Customer Baru" />
      <AutoForm fields={await customerFields()} action={createCustomer} cancelHref="/sales/customers" />
    </div>
  );
}
