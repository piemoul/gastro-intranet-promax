import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { settingFields } from "@/server/forms/admin-fields";
import { saveSetting } from "@/server/actions/admin";

export default function NewSettingPage() {
  return (
    <div>
      <PageHeader title="Setting Baru" subtitle="Mis. kurs CURR_RATE_USD_IDR" />
      <AutoForm fields={settingFields} action={saveSetting.bind(null, null)} cancelHref="/admin/settings" />
    </div>
  );
}
