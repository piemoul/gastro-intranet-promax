import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { permissions } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { permissionFields } from "@/server/forms/admin-fields";
import { savePermission } from "@/server/actions/admin";

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permId = Number(id);
  if (!Number.isFinite(permId)) notFound();
  const [p] = await db.select().from(permissions).where(eq(permissions.id, permId));
  if (!p) notFound();
  return (
    <div>
      <PageHeader title={`Edit aturan ${p.model}::${p.action}`} subtitle={`${p.department} · ${p.scope}`} />
      <AutoForm
        fields={permissionFields}
        values={p}
        action={savePermission.bind(null, permId)}
        cancelHref="/admin/roles"
      />
    </div>
  );
}
