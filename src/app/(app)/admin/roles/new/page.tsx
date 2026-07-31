import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { permissionFields } from "@/server/forms/admin-fields";
import { savePermission } from "@/server/actions/admin";

export default function NewRolePage() {
  return (
    <div>
      <PageHeader title="Aturan Izin Baru" subtitle="Departemen × rentang level × Model::action × scope" />
      <AutoForm
        fields={permissionFields}
        values={{ levelMin: "STAFF", levelMax: "CHIEF", scope: "SELF" }}
        action={savePermission.bind(null, null)}
        cancelHref="/admin/roles"
      />
    </div>
  );
}
