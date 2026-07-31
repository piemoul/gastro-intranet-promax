"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { db } from "@/server/db/client";
import { customers, items, quotationItems, quotations } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import {
  accurateConfigured,
  accurateGet,
  accuratePost,
  COMPANY_ID,
  findCustomerNo,
  writesEnabled,
} from "@/server/accurate/client";
import { canDecide, canPushToAccurate, canSubmit } from "@/lib/so-workflow";
import type { FormState } from "@/lib/form-defs";

async function actor() {
  const s = await getSession();
  if (!s) throw new Error("Sesi berakhir. Silakan login ulang.");
  return s;
}

/* ---------------- salesman: submit SQ for approval ---------------- */

export async function submitForApproval(id: number): Promise<void> {
  const s = await actor();
  const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!q) throw new Error("Quotation tidak ditemukan.");
  if (!canSubmit(q)) throw new Error("Quotation ini sudah diajukan atau sudah disetujui.");

  const lines = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
  if (lines.length === 0) throw new Error("Tidak bisa diajukan: belum ada item.");
  if (!q.customerId) throw new Error("Tidak bisa diajukan: customer belum dipilih.");

  await db
    .update(quotations)
    .set({
      soStatus: "SUBMITTED",
      soSubmittedAt: new Date(),
      soSubmittedById: s.uid,
      soRejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(quotations.id, id));

  await recordAudit({
    model: "Quotation", recordId: id, event: "update", session: s,
    changes: [{ field: "so_status", before: q.soStatus, after: "SUBMITTED" }],
  });
  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/approvals");
}

/* ---------------- admin: approve / reject ---------------- */

export async function approveSo(id: number): Promise<void> {
  const s = await actor();
  const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!q) throw new Error("Quotation tidak ditemukan.");
  if (!canDecide(q, { id: s.uid, isAdmin: s.isAdmin })) {
    throw new Error("Hanya admin yang bisa menyetujui, dan hanya yang berstatus diajukan.");
  }
  await db
    .update(quotations)
    .set({ soStatus: "APPROVED", soApprovedAt: new Date(), soApprovedById: s.uid, updatedAt: new Date() })
    .where(eq(quotations.id, id));
  await recordAudit({
    model: "Quotation", recordId: id, event: "update", session: s,
    changes: [{ field: "so_status", before: "SUBMITTED", after: "APPROVED" }],
  });
  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/approvals");
}

export async function rejectSo(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  const s = await actor();
  const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!q) return { error: "Quotation tidak ditemukan." };
  if (!canDecide(q, { id: s.uid, isAdmin: s.isAdmin })) {
    return { error: "Hanya admin yang bisa menolak, dan hanya yang berstatus diajukan." };
  }
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { fieldErrors: { reason: "Alasan penolakan wajib diisi" } };

  await db
    .update(quotations)
    .set({ soStatus: "REJECTED", soRejectionReason: reason, soApprovedById: s.uid, soApprovedAt: new Date(), updatedAt: new Date() })
    .where(eq(quotations.id, id));
  await recordAudit({
    model: "Quotation", recordId: id, event: "update", session: s,
    changes: [
      { field: "so_status", before: "SUBMITTED", after: "REJECTED" },
      { field: "so_rejection_reason", before: null, after: reason },
    ],
  });
  revalidatePath(`/sales/quotations/${id}`);
  revalidatePath("/sales/approvals");
  return { ok: true };
}

/* ---------------- admin: push approved SO to Accurate ---------------- */

export type PushResult = {
  dryRun: boolean;
  companyId: number;
  customerNo: string;
  customerCreated: boolean;
  lines: { itemNo: string; qty: string; unitPrice: string; unitName: string | null }[];
  params: Record<string, string>;
  soNumber?: string;
  error?: string;
};

/**
 * Build the exact Accurate payload for an approved order and (when writes are
 * enabled) send it. With ACCURATE_WRITE_ENABLED unset this is a pure dry run:
 * it only READS from Accurate to resolve the customer, and returns the payload
 * so it can be reviewed before anything is created.
 */
export async function pushToAccurate(id: number): Promise<PushResult> {
  const s = await actor();
  const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
  if (!q) throw new Error("Quotation tidak ditemukan.");
  if (!canPushToAccurate(q, { id: s.uid, isAdmin: s.isAdmin })) {
    throw new Error("Hanya SO yang sudah di-approve dan belum terkirim yang bisa dikirim ke Accurate.");
  }

  const companyId = COMPANY_ID[q.companyName ?? ""] ?? 0;
  if (!companyId) throw new Error(`Company "${q.companyName}" tidak dikenal (SARANA/GASTRO/RSP).`);
  if (!accurateConfigured(companyId)) throw new Error(`Kredensial Accurate untuk ${q.companyName} belum lengkap.`);

  const [cust] = q.customerId
    ? await db.select().from(customers).where(eq(customers.id, q.customerId))
    : [];
  if (!cust) throw new Error("Customer tidak ditemukan.");

  // 1) Resolve the customer in Accurate (read-only lookup).
  let customerNo = cust.accurateCustomerNo ?? null;
  let customerCreated = false;
  if (customerNo) {
    customerNo = (await findCustomerNo(companyId, customerNo)) ?? customerNo;
  } else {
    customerNo = await findCustomerNo(companyId, cust.custCode);
  }

  // 2) Create the customer in Accurate if it genuinely isn't there.
  if (!customerNo) {
    if (!writesEnabled()) {
      customerNo = cust.custCode; // what we WOULD create
      customerCreated = true;
    } else {
      const created = await accuratePost<{ customerNo?: string; id?: number }>(
        companyId,
        "customer/save.do",
        {
          customerNo: cust.custCode,
          name: cust.companyName ?? cust.custCode,
          ...(cust.address ? { billStreet: cust.address } : {}),
          ...(cust.picEmail ? { email: cust.picEmail } : {}),
          ...(cust.picPhone ? { mobilePhone: cust.picPhone } : {}),
        },
      );
      const d = Array.isArray(created.d) ? created.d[0] : created.d;
      customerNo = d?.customerNo ?? cust.custCode;
      customerCreated = true;
      await db
        .update(customers)
        .set({
          accurateCustomerNo: customerNo,
          accurateCompanyId: companyId,
          accurateId: d?.id ?? null,
          accurateSyncedAt: new Date(),
        })
        .where(eq(customers.id, cust.id));
    }
  }

  if (!customerNo) throw new Error("Nomor customer Accurate tidak bisa ditentukan.");

  // 3) Build the sales-order payload from our lines.
  const lines = await db
    .select({ line: quotationItems, itemSysId: items.sysId, itemUnit: items.unitName })
    .from(quotationItems)
    .leftJoin(items, eq(quotationItems.itemId, items.id))
    .where(eq(quotationItems.quotationId, id))
    .orderBy(quotationItems.lineNo);

  const params: Record<string, string> = {
    customerNo,
    transDate: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" })
      .format(new Date())
      .replace(/\//g, "/"),
    ...(q.qCode ? { description: `Dari SQ ${q.qCode}${q.qSubject ? ` — ${q.qSubject}` : ""}` } : {}),
    ...(q.qCurrency ? { currencyCode: q.qCurrency } : {}),
  };

  const summary: PushResult["lines"] = [];
  lines.forEach((row, i) => {
    const itemNo = row.itemSysId ?? "";
    if (!itemNo) return; // unlinked line: cannot be sent
    const qty = new Decimal(row.line.qty ?? 0).toString();
    const unitPrice = new Decimal(row.line.price ?? 0).toString();
    params[`detailItem[${i}].itemNo`] = itemNo;
    params[`detailItem[${i}].quantity`] = qty;
    params[`detailItem[${i}].unitPrice`] = unitPrice;
    if (row.itemUnit) params[`detailItem[${i}].itemUnitName`] = row.itemUnit;
    if (row.line.remarks) params[`detailItem[${i}].detailNotes`] = row.line.remarks;
    summary.push({ itemNo, qty, unitPrice, unitName: row.itemUnit });
  });

  if (summary.length === 0) {
    throw new Error(
      "Tidak ada baris yang bisa dikirim: item belum tertaut ke katalog Accurate. Buka editor Items dan pilih ulang barang.",
    );
  }

  // 4) Send (or report the dry run).
  if (!writesEnabled()) {
    return { dryRun: true, companyId, customerNo, customerCreated, lines: summary, params };
  }

  const saved = await accuratePost<{ id?: number; number?: string }>(companyId, "sales-order/save.do", params);
  const d = Array.isArray(saved.d) ? saved.d[0] : saved.d;
  await db
    .update(quotations)
    .set({ accurateSoNumber: d?.number ?? null, accurateSoId: d?.id ?? null, accurateSyncedAt: new Date() })
    .where(eq(quotations.id, id));
  await recordAudit({
    model: "Quotation", recordId: id, event: "update", session: s,
    changes: [{ field: "accurate_so_number", before: null, after: d?.number ?? "(tanpa nomor)" }],
  });
  revalidatePath(`/sales/quotations/${id}`);
  return { dryRun: false, companyId, customerNo, customerCreated, lines: summary, params, soNumber: d?.number };
}
