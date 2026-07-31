import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { branchFields } from "@/server/forms/admin-fields";
import { saveBranch } from "@/server/actions/admin";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branchId = Number(id);
  if (!Number.isFinite(branchId)) notFound();
  const [b] = await db.select().from(branches).where(eq(branches.id, branchId));
  if (!b) notFound();
  return (
    <div>
      <PageHeader title={`Edit ${b.name}`} />
      <AutoForm fields={branchFields} values={b} action={saveBranch.bind(null, branchId)} cancelHref="/admin/branches" />
    </div>
  );
}
