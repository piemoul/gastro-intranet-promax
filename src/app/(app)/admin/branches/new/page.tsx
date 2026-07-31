import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { branchFields } from "@/server/forms/admin-fields";
import { saveBranch } from "@/server/actions/admin";

export default function NewBranchPage() {
  return (
    <div>
      <PageHeader title="Branch Baru" />
      <AutoForm fields={branchFields} action={saveBranch.bind(null, null)} cancelHref="/admin/branches" />
    </div>
  );
}
