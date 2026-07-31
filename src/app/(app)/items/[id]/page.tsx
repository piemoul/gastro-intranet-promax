import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Pencil, Trash2 } from "lucide-react";
import { db } from "@/server/db/client";
import { itemBrands, itemBuyPrices, itemCostMultis, items, taxonomies } from "@/server/db/schema";
import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { SubResourcePanel } from "@/components/sub-resource-panel";
import { buttonVariants } from "@/components/ui/button";
import {
  addBuyPrice,
  addCostMulti,
  deleteBuyPrice,
  deleteCostMulti,
  deleteItem,
  setDefaultBuyPrice,
  setDefaultCostMulti,
} from "@/server/actions/items";
import { cn } from "@/lib/utils";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("Item", "show"))) return <Forbidden what="item ini" />;
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) notFound();

  const [row] = await db
    .select({ item: items, brand: itemBrands.name })
    .from(items)
    .leftJoin(itemBrands, eq(items.brandId, itemBrands.id))
    .where(eq(items.id, itemId));
  if (!row) notFound();
  const item = row.item;

  const [buys, costs, canEdit, canDelete] = await Promise.all([
    db.select().from(itemBuyPrices).where(eq(itemBuyPrices.itemId, itemId)),
    db.select().from(itemCostMultis).where(eq(itemCostMultis.itemId, itemId)),
    can("Item", "update"),
    can("Item", "destroy"),
  ]);

  const tiers = [
    item.sellPriceTier0, item.sellPriceTier1, item.sellPriceTier2,
    item.sellPriceTier3, item.sellPriceTier4, item.sellPriceTier5,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.sysId}
        subtitle={[row.brand, item.model].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/items/${itemId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                <Pencil /> Edit
              </Link>
            )}
            {canDelete && (
              <form action={deleteItem.bind(null, itemId)}>
                <button type="submit" className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}>
                  <Trash2 /> Hapus
                </button>
              </form>
            )}
          </div>
        }
      />

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand">Harga Jual ({item.sellPriceCurrency ?? "—"})</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {tiers.map((t, i) => (
            <div key={i} className="rounded-md border border-border p-3 text-center">
              <div className="text-xs text-muted">Tier {i}</div>
              <div className="mt-1 font-semibold tabular-nums text-brand-dark">
                {t ? Number(t).toLocaleString("id-ID") : "—"}
              </div>
            </div>
          ))}
        </div>
        {item.description && (
          <p className="mt-4 text-sm text-muted">
            <span className="font-medium text-brand-dark">Deskripsi: </span>
            {item.description}
          </p>
        )}
        {item.keySpecification && (
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-brand-dark">Key spec: </span>
            {item.keySpecification}
          </p>
        )}
      </div>

      <SubResourcePanel
        title="Buy Prices (IBP)"
        labelHeader="Nama"
        valueHeader="Harga"
        withCurrency
        rows={buys.map((b) => ({
          id: b.id,
          label: b.name ?? "—",
          value: `${b.currency ?? ""} ${b.price ? Number(b.price).toLocaleString("id-ID") : "—"}`,
          isDefault: b.isDefault,
        }))}
        addAction={addBuyPrice.bind(null, itemId)}
        setDefault={setDefaultBuyPrice.bind(null, itemId)}
        remove={deleteBuyPrice.bind(null, itemId)}
        canEdit={canEdit}
      />

      <SubResourcePanel
        title="Cost Multipliers (ICM)"
        labelHeader="Deskripsi"
        valueHeader="Multiplier"
        rows={costs.map((c) => ({
          id: c.id,
          label: c.description ?? "—",
          value: c.multiplier ? String(Number(c.multiplier)) : "—",
          isDefault: c.isDefault,
        }))}
        addAction={addCostMulti.bind(null, itemId)}
        setDefault={setDefaultCostMulti.bind(null, itemId)}
        remove={deleteCostMulti.bind(null, itemId)}
        canEdit={canEdit}
      />

      {Object.keys((item.specs as object) ?? {}).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand">Spesifikasi Lain</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries((item.specs as Record<string, string>) ?? {}).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted">{k.replace(/_/g, " ")}:</dt>
                <dd className="font-medium text-brand-dark">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
