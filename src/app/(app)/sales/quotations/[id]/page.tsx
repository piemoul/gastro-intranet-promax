import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { aliasedTable, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { customers, quotationItems, quotations, users } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { idr } from "@/lib/format";
import { lineResult, type FxSnapshot } from "@/lib/pricing";
import type { Currency } from "@/lib/constants";

const FX_KEYS: (keyof FxSnapshot)[] = [
  "usdIdr", "eurUsd", "sgdUsd", "jpyUsd", "nzdUsd", "gbpUsd", "krwUsd", "rmbUsd", "sekUsd",
];

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Quotation", "show"))) return <Forbidden what="quotation ini" />;
  const { id } = await params;
  const quotationId = Number(id);
  if (!Number.isFinite(quotationId)) notFound();

  const sales = aliasedTable(users, "sales");
  const [q] = await db
    .select({
      q: quotations,
      customerName: customers.companyName,
      salesName: sales.name,
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(sales, eq(quotations.salesId, sales.id))
    .where(eq(quotations.id, quotationId))
    .limit(1);
  if (!q) notFound();

  const lines = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId))
    .orderBy(quotationItems.lineNo);

  const fx: FxSnapshot = {
    usdIdr: q.q.fxUsdIdr ?? 0,
    eurUsd: q.q.fxEurUsd ?? 0,
    sgdUsd: q.q.fxSgdUsd ?? 0,
    jpyUsd: q.q.fxJpyUsd ?? 0,
    nzdUsd: q.q.fxNzdUsd ?? 0,
    gbpUsd: q.q.fxGbpUsd ?? 0,
    krwUsd: q.q.fxKrwUsd ?? 0,
    rmbUsd: q.q.fxRmbUsd ?? 0,
    sekUsd: q.q.fxSekUsd ?? 0,
  };

  const computed = lines.map((ln) => {
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
    return { ln, sellIdr: r.sellIdr };
  });
  const total = computed.reduce((s, c) => s.add(c.sellIdr), new Decimal(0));

  return (
    <div className="space-y-6">
      <PageHeader
        title={q.q.qCode ?? `Quotation #${q.q.id}`}
        subtitle={q.q.qSubject ?? undefined}
        action={
          <Link
            href={`/sales/quotations/${quotationId}/pdf`}
            className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark"
          >
            PDF
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Info label="Customer" value={q.customerName ?? "—"} />
        <Info label="Sales" value={q.salesName ?? "—"} />
        <Info label="Company / Status" value={`${q.q.companyName ?? "—"} · ${q.q.qStatus ?? "—"}`} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Items</h2>
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH className="text-right">Qty</TH>
              <TH>Currency</TH>
              <TH className="text-right">Harga</TH>
              <TH className="text-right">Subtotal (IDR)</TH>
            </TR>
          </THead>
          <TBody>
            {computed.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-6 text-center text-muted">
                  Tidak ada line item.
                </TD>
              </TR>
            )}
            {computed.map(({ ln, sellIdr }) => (
              <TR key={ln.id}>
                <TD className="font-medium text-brand-dark">{ln.itemLabel ?? "—"}</TD>
                <TD className="text-right tabular-nums">{ln.qty ?? "—"}</TD>
                <TD>{ln.currency ?? "—"}</TD>
                <TD className="text-right tabular-nums">
                  {ln.price ? Number(ln.price).toLocaleString("id-ID") : "—"}
                </TD>
                <TD className="text-right tabular-nums">{idr(sellIdr.toString())}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="mt-3 flex justify-end">
          <div className="rounded-lg border border-border bg-brand-light px-6 py-3 text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Total (exc. PPN)</div>
            <div className="text-xl font-bold text-brand">{idr(total.toString())}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">FX Snapshot</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-border bg-card p-4 text-xs text-muted">
          {FX_KEYS.map((k) => (
            <span key={k}>
              {k}: <span className="font-mono text-brand-dark">{String(fx[k])}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-medium text-brand-dark">{value}</div>
    </div>
  );
}
