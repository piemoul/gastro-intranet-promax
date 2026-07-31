import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { userFields } from "@/server/forms/admin-fields";
import { saveUser } from "@/server/actions/admin";

export default async function NewUserPage() {
  return (
    <div>
      <PageHeader title="User Baru" />
      <AutoForm
        fields={await userFields()}
        values={{ active: true }}
        action={saveUser.bind(null, null)}
        cancelHref="/admin/users"
      />
    </div>
  );
}
