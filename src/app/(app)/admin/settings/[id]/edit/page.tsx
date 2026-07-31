import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { settingFields } from "@/server/forms/admin-fields";
import { saveSetting } from "@/server/actions/admin";

export default async function EditSettingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settingId = Number(id);
  if (!Number.isFinite(settingId)) notFound();
  const [row] = await db.select().from(settings).where(eq(settings.id, settingId));
  if (!row) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${row.key}`} />
      <AutoForm
        fields={settingFields}
        values={row}
        action={saveSetting.bind(null, settingId)}
        cancelHref="/admin/settings"
      />
    </div>
  );
}
