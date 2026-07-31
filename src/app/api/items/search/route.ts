import { NextResponse } from "next/server";
import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { itemBrands, items } from "@/server/db/schema";
import { can } from "@/server/auth/guard";

/** Item autocomplete for the quotation line editor (ports Item::autocomplete). */
export async function GET(req: Request) {
  if (!(await can("Item", "index"))) return NextResponse.json([], { status: 403 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const rows = await db
    .select({
      id: items.id,
      sysId: items.sysId,
      model: items.model,
      description: items.description,
      brand: itemBrands.name,
      currency: items.sellPriceCurrency,
      tier0: items.sellPriceTier0,
      tier1: items.sellPriceTier1,
      tier2: items.sellPriceTier2,
      tier3: items.sellPriceTier3,
      tier4: items.sellPriceTier4,
      tier5: items.sellPriceTier5,
      deliveryCost: items.defaultDeliveryCost,
    })
    .from(items)
    .leftJoin(itemBrands, sql`${items.brandId} = ${itemBrands.id}`)
    .where(or(ilike(items.sysId, `%${q}%`), ilike(items.model, `%${q}%`), ilike(items.description, `%${q}%`)))
    .limit(25);

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      label: [r.brand, r.model, r.description].filter(Boolean).join(" - ").slice(0, 160),
      tiers: [r.tier0, r.tier1, r.tier2, r.tier3, r.tier4, r.tier5],
    })),
  );
}
