"use server";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import {
  quotationAdditionalItems,
  quotationItems,
  quotations,
  settings,
  users,
} from "@/server/db/schema";
import { diff, recordAudit } from "@/server/audit";
import { bool, dbError, guardWrite, int, nestedRows, num, s } from "./helpers";
import type { FormState } from "@/lib/form-defs";

/** Read the global CURR_RATE_* table and snapshot it onto a new quotation. */
async function fxSnapshot() {
  const rows = await db.select().from(settings).where(like(settings.key, "CURR_RATE_%"));
  const by = new Map(rows.map((r) => [r.key, r.valueDecimal]));
  return {
    fxUsdIdr: by.get("CURR_RATE_USD_IDR") ?? null,
    fxEurUsd: by.get("CURR_RATE_EUR_USD") ?? null,
    fxSgdUsd: by.get("CURR_RATE_SGD_USD") ?? null,
    fxJpyUsd: by.get("CURR_RATE_JPY_USD") ?? null,
    fxNzdUsd: by.get("CURR_RATE_NZD_USD") ?? null,
    fxGbpUsd: by.get("CURR_RATE_GBP_USD") ?? null,
    fxKrwUsd: by.get("CURR_RATE_KRW_USD") ?? null,
    fxRmbUsd: by.get("CURR_RATE_RMB_USD") ?? null,
    fxSekUsd: by.get("CURR_RATE_SEK_USD") ?? null,
  };
}

/** Generate QUOT-<initials>-<YYYY>-<MM>-<NNNN>, mirroring the legacy code format. */
async function nextQCode(salesId: number | null): Promise<string> {
  let initials = "XX";
  if (salesId) {
    const [u] = await db.select({ n: users.name, nick: users.nickname }).from(users).where(eq(users.id, salesId));
    const base = (u?.nick || u?.n || "").replace(/[^A-Za-z ]/g, "").trim();
    if (base) {
      const parts = base.split(/\s+/);
      initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "XX";
    }
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `QUOT-${initials}-${y}-${m}-`;
  const [last] = await db
    .select({ code: quotations.qCode })
    .from(quotations)
    .where(like(quotations.qCode, `${prefix}%`))
    .orderBy(desc(quotations.qCode))
    .limit(1);
  const seq = last?.code ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return prefix + String(Number.isFinite(seq) ? seq : 1).padStart(4, "0");
}

/** Field set shared by create & update. */
function headerValues(fd: FormData) {
  const termsOthers: Record<string, string> = {};
  for (const k of ["franco_others", "delivery_others", "installation_others", "validity_others", "warranty_others", "payment_others"]) {
    const v = s(fd, k);
    if (v) termsOthers[k] = v;
  }
  return {
    qSubject: s(fd, "qSubject"),
    qDate: s(fd, "qDate"),
    companyName: s(fd, "companyName"),
    qCurrency: s(fd, "qCurrency"),
    qLang: s(fd, "qLang"),
    qType: s(fd, "qType"),
    qStatus: s(fd, "qStatus") ?? "DRAFT",
    qPriceApproval: s(fd, "qPriceApproval"),
    customerId: int(fd, "customerId"),
    customerPic: s(fd, "customerPic"),
    salesId: int(fd, "salesId"),
    salesAdminId: int(fd, "salesAdminId"),
    branchId: int(fd, "branchId"),
    includeDiInPrice: bool(fd, "includeDiInPrice"),
    roundIdrOption: bool(fd, "roundIdrOption"),
    franco: s(fd, "franco"),
    delivery: s(fd, "delivery"),
    installation: s(fd, "installation"),
    validity: s(fd, "validity"),
    warranty: s(fd, "warranty"),
    payment: s(fd, "payment"),
    ppn: s(fd, "ppn"),
    termsOthers,
    qNotes: s(fd, "qNotes"),
    catInternal: s(fd, "catInternal"),
  };
}

export async function createQuotation(_p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Quotation", "create");
  if (!g.ok) return g.state;
  let newId: number;
  try {
    const v = headerValues(fd);
    const salesId = v.salesId ?? g.session.uid;
    const values = {
      ...v,
      salesId,
      qCode: s(fd, "qCode") ?? (await nextQCode(salesId)),
      qRev: 0,
      ...(await fxSnapshot()),
      createdById: g.session.uid,
      updatedById: g.session.uid,
    };
    const [row] = await db.insert(quotations).values(values).returning({ id: quotations.id });
    newId = row.id;
    await recordAudit({
      model: "Quotation",
      recordId: newId,
      event: "create",
      session: g.session,
      changes: diff(null, values),
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${newId}/items`);
}

export async function updateQuotation(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Quotation", "update");
  if (!g.ok) return g.state;
  try {
    const [before] = await db.select().from(quotations).where(eq(quotations.id, id));
    if (!before) return { error: "Quotation tidak ditemukan." };
    const values = { ...headerValues(fd), updatedById: g.session.uid, updatedAt: new Date() };
    await db.update(quotations).set(values).where(eq(quotations.id, id));
    await recordAudit({
      model: "Quotation",
      recordId: id,
      event: "update",
      session: g.session,
      changes: diff(before, values, ["id", "createdAt", "updatedAt", "legacyId", "updatedById"]),
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/sales/quotations/${id}`);
  redirect(`/sales/quotations/${id}`);
}

/** Replace the line items + additional items of a quotation. */
export async function saveQuotationItems(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Quotation", "update");
  if (!g.ok) return g.state;
  try {
    const lines = nestedRows(fd, "lines");
    const extras = nestedRows(fd, "extras");

    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    const toInsert = lines
      .filter((l) => (l.itemLabel ?? "").trim() !== "" || (l.price ?? "").trim() !== "")
      .map((l, i) => ({
        quotationId: id,
        lineNo: i,
        itemId: l.itemId && Number.isInteger(Number(l.itemId)) ? Number(l.itemId) : null,
        itemLabel: l.itemLabel?.trim() || null,
        qty: l.qty?.trim() || null,
        currency: l.currency?.trim() || null,
        price: l.price?.replace(/,/g, "").trim() || null,
        deliveryCost: l.deliveryCost?.replace(/,/g, "").trim() || null,
        installCost: l.installCost?.replace(/,/g, "").trim() || null,
        remarks: l.remarks?.trim() || null,
      }));
    if (toInsert.length) await db.insert(quotationItems).values(toInsert);

    await db.delete(quotationAdditionalItems).where(eq(quotationAdditionalItems.quotationId, id));
    const extraRows = extras
      .filter((x) => (x.label ?? "").trim() !== "")
      .map((x, i) => ({
        quotationId: id,
        lineNo: i,
        label: x.label.trim(),
        amount: x.amount?.replace(/,/g, "").trim() || null,
      }));
    if (extraRows.length) await db.insert(quotationAdditionalItems).values(extraRows);

    await db.update(quotations).set({ updatedById: g.session.uid, updatedAt: new Date() }).where(eq(quotations.id, id));
    await recordAudit({
      model: "Quotation",
      recordId: id,
      event: "update",
      session: g.session,
      changes: [{ field: "items", before: null, after: `${toInsert.length} baris, ${extraRows.length} tambahan` }],
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/sales/quotations/${id}`);
  redirect(`/sales/quotations/${id}`);
}

/** Copy a quotation into a brand-new one (fresh code, rev 0, DRAFT). */
export async function duplicateQuotation(id: number): Promise<void> {
  const g = await guardWrite("Quotation", "create");
  if (!g.ok) throw new Error(g.state.error);
  const [src] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!src) throw new Error("Quotation tidak ditemukan.");
  const { id: _drop, legacyId: _l, createdAt: _c, updatedAt: _u, ...rest } = src;
  const [row] = await db
    .insert(quotations)
    .values({
      ...rest,
      qCode: await nextQCode(src.salesId),
      qRev: 0,
      parentQuotationId: null,
      qStatus: "DRAFT",
      ...(await fxSnapshot()),
      createdById: g.session.uid,
      updatedById: g.session.uid,
    })
    .returning({ id: quotations.id });
  await copyLines(id, row.id);
  await recordAudit({
    model: "Quotation",
    recordId: row.id,
    event: "create",
    session: g.session,
    changes: [{ field: "duplicated_from", before: null, after: src.qCode ?? String(id) }],
  });
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${row.id}/edit`);
}

/** Create the next revision: same code, q_rev + 1, linked to the parent. */
export async function reviseQuotation(id: number): Promise<void> {
  const g = await guardWrite("Quotation", "create");
  if (!g.ok) throw new Error(g.state.error);
  const [src] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!src) throw new Error("Quotation tidak ditemukan.");
  const { id: _drop, legacyId: _l, createdAt: _c, updatedAt: _u, ...rest } = src;
  const [row] = await db
    .insert(quotations)
    .values({
      ...rest,
      qRev: (src.qRev ?? 0) + 1,
      parentQuotationId: src.parentQuotationId ?? src.id,
      qStatus: "DRAFT",
      ...(await fxSnapshot()),
      createdById: g.session.uid,
      updatedById: g.session.uid,
    })
    .returning({ id: quotations.id });
  await copyLines(id, row.id);
  await recordAudit({
    model: "Quotation",
    recordId: row.id,
    event: "create",
    session: g.session,
    changes: [{ field: "revision_of", before: String(src.qRev ?? 0), after: String((src.qRev ?? 0) + 1) }],
  });
  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${row.id}/edit`);
}

async function copyLines(fromId: number, toId: number) {
  const lines = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, fromId));
  if (lines.length)
    await db.insert(quotationItems).values(
      lines.map(({ id: _i, legacyId: _l, createdAt: _c, ...l }) => ({ ...l, quotationId: toId })),
    );
  const extras = await db
    .select()
    .from(quotationAdditionalItems)
    .where(eq(quotationAdditionalItems.quotationId, fromId));
  if (extras.length)
    await db.insert(quotationAdditionalItems).values(
      extras.map(({ id: _i, legacyId: _l, createdAt: _c, ...x }) => ({ ...x, quotationId: toId })),
    );
}

export async function deleteQuotation(id: number): Promise<void> {
  const g = await guardWrite("Quotation", "destroy");
  if (!g.ok) throw new Error(g.state.error);
  const [before] = await db.select().from(quotations).where(eq(quotations.id, id));
  await db.delete(quotations).where(eq(quotations.id, id));
  await recordAudit({
    model: "Quotation",
    recordId: id,
    event: "destroy",
    session: g.session,
    changes: [{ field: "q_code", before: before?.qCode ?? null, after: null }],
  });
  revalidatePath("/sales/quotations");
  redirect("/sales/quotations");
}
