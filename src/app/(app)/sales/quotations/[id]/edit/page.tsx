import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { quotations } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { quotationFields, quotationValues } from "@/server/forms/quotation-fields";
import { updateQuotation } from "@/server/actions/quotations";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Quotation", "update"))) return <Forbidden what="perubahan quotation" />;
  const { id } = await params;
  const quotationId = Number(id);
  if (!Number.isFinite(quotationId)) notFound();

  const [q] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!q) notFound();
  const fields = await quotationFields();

  const action = updateQuotation.bind(null, quotationId);

  return (
    <div>
      <PageHeader
        title={`Edit ${q.qCode ?? `#${q.id}`}`}
        subtitle={q.qRev ? `Revisi ke-${q.qRev}` : undefined}
      />
      <AutoForm
        fields={fields}
        values={quotationValues(q)}
        action={action}
        submitLabel="Simpan Perubahan"
        cancelHref={`/sales/quotations/${quotationId}`}
      />
    </div>
  );
}
