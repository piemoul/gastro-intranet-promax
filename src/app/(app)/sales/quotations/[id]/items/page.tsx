import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { quotationAdditionalItems, quotationItems, quotations } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { QuotationItemsEditor } from "@/components/quotation-items-editor";
import { saveQuotationItems } from "@/server/actions/quotations";
import type { FxSnapshot } from "@/lib/pricing";

export default async function QuotationItemsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Quotation", "update"))) return <Forbidden what="perubahan item quotation" />;
  const { id } = await params;
  const quotationId = Number(id);
  if (!Number.isFinite(quotationId)) notFound();

  const [q] = await db.select().from(quotations).where(eq(quotations.id, quotationId));
  if (!q) notFound();

  const [lines, extras] = await Promise.all([
    db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId)).orderBy(quotationItems.lineNo),
    db
      .select()
      .from(quotationAdditionalItems)
      .where(eq(quotationAdditionalItems.quotationId, quotationId))
      .orderBy(quotationAdditionalItems.lineNo),
  ]);

  const fx: FxSnapshot = {
    usdIdr: q.fxUsdIdr ?? 0, eurUsd: q.fxEurUsd ?? 0, sgdUsd: q.fxSgdUsd ?? 0,
    jpyUsd: q.fxJpyUsd ?? 0, nzdUsd: q.fxNzdUsd ?? 0, gbpUsd: q.fxGbpUsd ?? 0,
    krwUsd: q.fxKrwUsd ?? 0, rmbUsd: q.fxRmbUsd ?? 0, sekUsd: q.fxSekUsd ?? 0,
  };

  const action = saveQuotationItems.bind(null, quotationId);

  return (
    <div>
      <PageHeader
        title={`Items — ${q.qCode ?? `#${q.id}`}`}
        subtitle="Subtotal dihitung real-time memakai kurs snapshot quotation ini"
      />
      <QuotationItemsEditor
        action={action}
        initialLines={lines.map((l) => ({
          itemId: l.itemId ? String(l.itemId) : "",
          itemLabel: l.itemLabel ?? "",
          qty: l.qty ?? "1",
          currency: l.currency ?? "IDR",
          price: l.price ?? "",
          deliveryCost: l.deliveryCost ?? "",
          installCost: l.installCost ?? "",
          remarks: l.remarks ?? "",
        }))}
        initialExtras={extras.map((x) => ({ label: x.label ?? "", amount: x.amount ?? "" }))}
        fx={fx}
        includeDiInPrice={q.includeDiInPrice}
        roundIdrOption={q.roundIdrOption}
        backHref={`/sales/quotations/${quotationId}`}
      />
    </div>
  );
}
