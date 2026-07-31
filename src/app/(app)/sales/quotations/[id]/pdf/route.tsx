import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { renderToBuffer } from "@react-pdf/renderer";
import { aliasedTable, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers, quotationItems, quotations, users } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { lineResult, type FxSnapshot } from "@/lib/pricing";
import { QuotationPdf, type QuotationPdfData } from "@/server/pdf/quotation-pdf";
import { date as fmtDate } from "@/lib/format";
import type { Currency } from "@/lib/constants";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Quotation", "show"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const quotationId = Number(id);
  if (!Number.isFinite(quotationId)) return new NextResponse("Not found", { status: 404 });

  const sales = aliasedTable(users, "sales");
  const [q] = await db
    .select({ q: quotations, customerName: customers.companyName, salesName: sales.name })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(sales, eq(quotations.salesId, sales.id))
    .where(eq(quotations.id, quotationId))
    .limit(1);
  if (!q) return new NextResponse("Not found", { status: 404 });

  const lines = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId))
    .orderBy(quotationItems.lineNo);

  const fx: FxSnapshot = {
    usdIdr: q.q.fxUsdIdr ?? 0, eurUsd: q.q.fxEurUsd ?? 0, sgdUsd: q.q.fxSgdUsd ?? 0,
    jpyUsd: q.q.fxJpyUsd ?? 0, nzdUsd: q.q.fxNzdUsd ?? 0, gbpUsd: q.q.fxGbpUsd ?? 0,
    krwUsd: q.q.fxKrwUsd ?? 0, rmbUsd: q.q.fxRmbUsd ?? 0, sekUsd: q.q.fxSekUsd ?? 0,
  };

  let total = new Decimal(0);
  const pdfLines = lines.map((ln) => {
    const r = lineResult(
      {
        qty: ln.qty ?? 0,
        currency: (ln.currency as Currency) ?? "IDR",
        price: ln.price ?? 0,
        deliveryCost: ln.deliveryCost ?? 0,
        installCost: ln.installCost ?? 0,
      },
      { fx, includeDiInPrice: q.q.includeDiInPrice, roundIdrOption: q.q.roundIdrOption },
    );
    total = total.add(r.sellIdr);
    return {
      label: ln.itemLabel ?? "—",
      qty: String(ln.qty ?? ""),
      currency: ln.currency ?? "IDR",
      unit: String(ln.price ?? "0"),
      subtotalIdr: r.sellIdr.toString(),
    };
  });

  const terms: { label: string; value: string }[] = [
    ["Franco", q.q.franco], ["Delivery", q.q.delivery], ["Installation", q.q.installation],
    ["Validity", q.q.validity], ["Warranty", q.q.warranty], ["Payment", q.q.payment], ["PPN", q.q.ppn],
  ]
    .filter(([, v]) => v)
    .map(([label, value]) => ({ label: label as string, value: value as string }));

  const data: QuotationPdfData = {
    qCode: q.q.qCode ?? `Quotation-${q.q.id}`,
    company: q.q.companyName ?? "SARANA",
    lang: q.q.qLang ?? "ID",
    subject: q.q.qSubject,
    date: q.q.qDate ? fmtDate(q.q.qDate) : null,
    customer: q.customerName,
    customerPic: q.q.customerPic,
    salesName: q.salesName,
    status: q.q.qStatus,
    lines: pdfLines,
    totalIdr: total.toString(),
    terms,
  };

  const buffer = await renderToBuffer(<QuotationPdf data={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.qCode}.pdf"`,
    },
  });
}
