"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { itemBuyPrices, itemCostMultis, items } from "@/server/db/schema";
import { diff, recordAudit } from "@/server/audit";
import { dbError, guardWrite, int, num, s } from "./helpers";
import type { FormState } from "@/lib/form-defs";

function itemValues(fd: FormData) {
  return {
    sysId: s(fd, "sysId") ?? "",
    itemCode: s(fd, "itemCode"),
    model: s(fd, "model"),
    brandId: int(fd, "brandId"),
    categoryId: int(fd, "categoryId"),
    subCategory1Id: int(fd, "subCategory1Id"),
    subCategory2Id: int(fd, "subCategory2Id"),
    seriesId: int(fd, "seriesId"),
    permission: s(fd, "permission"),
    sortOrder: int(fd, "sortOrder"),
    sellPriceCurrency: s(fd, "sellPriceCurrency"),
    sellPriceTier0: num(fd, "sellPriceTier0"),
    sellPriceTier1: num(fd, "sellPriceTier1"),
    sellPriceTier2: num(fd, "sellPriceTier2"),
    sellPriceTier3: num(fd, "sellPriceTier3"),
    sellPriceTier4: num(fd, "sellPriceTier4"),
    sellPriceTier5: num(fd, "sellPriceTier5"),
    defaultCostCurrency: s(fd, "defaultCostCurrency"),
    defaultDeliveryCost: num(fd, "defaultDeliveryCost"),
    description: s(fd, "description"),
    keySpecification: s(fd, "keySpecification"),
  };
}

export async function createItem(_p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Item", "create");
  if (!g.ok) return g.state;
  let newId: number;
  try {
    const values = itemValues(fd);
    if (!values.sysId) return { fieldErrors: { sysId: "SYSID wajib diisi" } };
    const [row] = await db.insert(items).values(values).returning({ id: items.id });
    newId = row.id;
    await recordAudit({ model: "Item", recordId: newId, event: "create", session: g.session, changes: diff(null, values) });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/items");
  redirect(`/items/${newId}`);
}

export async function updateItem(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) return g.state;
  try {
    const [before] = await db.select().from(items).where(eq(items.id, id));
    if (!before) return { error: "Item tidak ditemukan." };
    const values = { ...itemValues(fd), updatedAt: new Date() };
    if (!values.sysId) return { fieldErrors: { sysId: "SYSID wajib diisi" } };
    await db.update(items).set(values).where(eq(items.id, id));
    await recordAudit({
      model: "Item",
      recordId: id,
      event: "update",
      session: g.session,
      changes: diff(before, values),
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}

export async function deleteItem(id: number): Promise<void> {
  const g = await guardWrite("Item", "destroy");
  if (!g.ok) throw new Error(g.state.error);
  const [before] = await db.select().from(items).where(eq(items.id, id));
  await db.delete(items).where(eq(items.id, id));
  await recordAudit({
    model: "Item",
    recordId: id,
    event: "destroy",
    session: g.session,
    changes: [{ field: "sys_id", before: before?.sysId ?? null, after: null }],
  });
  revalidatePath("/items");
  redirect("/items");
}

/* ---------- Buy prices ---------- */

export async function addBuyPrice(itemId: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) return g.state;
  try {
    const values = {
      itemId,
      name: s(fd, "name"),
      price: num(fd, "price"),
      currency: s(fd, "currency"),
      isDefault: false,
    };
    if (!values.name) return { fieldErrors: { name: "Nama wajib diisi" } };
    await db.insert(itemBuyPrices).values(values);
    await recordAudit({
      model: "Item", recordId: itemId, event: "update", session: g.session,
      changes: [{ field: "buy_price", before: null, after: `${values.name} = ${values.currency ?? ""} ${values.price ?? ""}` }],
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/items/${itemId}`);
  return { ok: true };
}

export async function setDefaultBuyPrice(itemId: number, priceId: number): Promise<void> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) throw new Error(g.state.error);
  await db.update(itemBuyPrices).set({ isDefault: false }).where(eq(itemBuyPrices.itemId, itemId));
  await db.update(itemBuyPrices).set({ isDefault: true }).where(eq(itemBuyPrices.id, priceId));
  revalidatePath(`/items/${itemId}`);
}

export async function deleteBuyPrice(itemId: number, priceId: number): Promise<void> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(itemBuyPrices).where(and(eq(itemBuyPrices.id, priceId), eq(itemBuyPrices.itemId, itemId)));
  revalidatePath(`/items/${itemId}`);
}

/* ---------- Cost multipliers ---------- */

export async function addCostMulti(itemId: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) return g.state;
  try {
    const values = {
      itemId,
      description: s(fd, "description"),
      multiplier: num(fd, "multiplier"),
      isDefault: false,
    };
    if (!values.description) return { fieldErrors: { description: "Deskripsi wajib diisi" } };
    await db.insert(itemCostMultis).values(values);
    await recordAudit({
      model: "Item", recordId: itemId, event: "update", session: g.session,
      changes: [{ field: "cost_multi", before: null, after: `${values.description} = ${values.multiplier ?? ""}` }],
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/items/${itemId}`);
  return { ok: true };
}

export async function setDefaultCostMulti(itemId: number, multiId: number): Promise<void> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) throw new Error(g.state.error);
  await db.update(itemCostMultis).set({ isDefault: false }).where(eq(itemCostMultis.itemId, itemId));
  await db.update(itemCostMultis).set({ isDefault: true }).where(eq(itemCostMultis.id, multiId));
  revalidatePath(`/items/${itemId}`);
}

export async function deleteCostMulti(itemId: number, multiId: number): Promise<void> {
  const g = await guardWrite("Item", "update");
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(itemCostMultis).where(and(eq(itemCostMultis.id, multiId), eq(itemCostMultis.itemId, itemId)));
  revalidatePath(`/items/${itemId}`);
}
