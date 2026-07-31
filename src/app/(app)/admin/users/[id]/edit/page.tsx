import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { userFields } from "@/server/forms/admin-fields";
import { saveUser } from "@/server/actions/admin";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${u.name}`} subtitle={u.email} />
      <AutoForm
        fields={await userFields()}
        values={{ ...u, password: "" }}
        action={saveUser.bind(null, userId)}
        cancelHref="/admin/users"
      />
    </div>
  );
}
