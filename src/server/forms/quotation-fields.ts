import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches, customers, users } from "@/server/db/schema";
import {
  COMPANY_OPTIONS,
  CURRENCY_OPTIONS,
  LANG_OPTIONS,
  QUOTATION_STATUS_OPTIONS,
  toOptions,
  type FieldDef,
} from "@/lib/form-defs";

// Legacy term dropdowns (values observed on the live system; "Lainnya" opens the free-text field).
const FRANCO = ["Jabodetabek", "Jakarta", "Lainnya (isi di bawah)"];
const PAYMENT = ["100% sebelum barang dikirim", "50% DP, 50% sebelum kirim", "30 hari setelah barang diterima", "Lainnya (isi di bawah)"];
const PPN = ["Belum termasuk PPN 11%", "Belum termasuk PPN 12%", "Sudah termasuk PPN"];
const VALIDITY = ["7 (tujuh) hari", "14 (empat belas) hari", "30 (tiga puluh) hari"];
const WARRANTY = [
  "1 (satu) tahun untuk parts dan service (syarat dan ketentuan berlaku)",
  "6 (enam) bulan untuk parts dan service",
  "Lainnya (isi di bawah)",
];
const DELIVERY = ["Ready stock", "2-4 minggu setelah PO", "8-12 minggu setelah PO", "Lainnya (isi di bawah)"];
const INSTALLATION = ["Termasuk", "Tidak termasuk", "Lainnya (isi di bawah)"];
const QTYPE = ["UNIT SALES", "PROJECT", "SPAREPART", "SERVICE"];

const opts = (arr: string[]) => arr.map((v) => ({ value: v, label: v }));

/** The 39-field quotation header form, grouped into sections. */
export async function quotationFields(): Promise<FieldDef[]> {
  const [customerRows, userRows, branchRows] = await Promise.all([
    db.select({ id: customers.id, companyName: customers.companyName, custCode: customers.custCode })
      .from(customers).orderBy(asc(customers.companyName)).limit(2000),
    db.select({ id: users.id, name: users.name, department: users.department })
      .from(users).orderBy(asc(users.name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name)),
  ]);

  const customerOpts = toOptions(customerRows, (c) => `${c.custCode} — ${c.companyName ?? ""}`);
  const userOpts = toOptions(userRows, (u) => `${u.name}${u.department ? ` (${u.department})` : ""}`);
  const branchOpts = toOptions(branchRows, (b) => b.name);

  const S1 = "Informasi Penawaran";
  const S2 = "Customer & Sales";
  const S3 = "Opsi Harga";
  const S4 = "Syarat & Ketentuan";
  const S5 = "Catatan";

  return [
    { name: "qCode", label: "Kode Quotation", section: S1, hint: "Kosongkan untuk generate otomatis" },
    { name: "qSubject", label: "Subjek", section: S1, span: 2, required: true },
    { name: "qDate", label: "Tanggal", type: "date", section: S1 },
    { name: "companyName", label: "Company", type: "select", options: COMPANY_OPTIONS, section: S1, required: true },
    { name: "qType", label: "Tipe", type: "select", options: opts(QTYPE), section: S1 },
    { name: "qStatus", label: "Status", type: "select", options: QUOTATION_STATUS_OPTIONS, section: S1 },
    { name: "qLang", label: "Bahasa PDF", type: "select", options: LANG_OPTIONS, section: S1 },
    { name: "qCurrency", label: "Mata Uang", type: "select", options: CURRENCY_OPTIONS, section: S1 },
    { name: "qPriceApproval", label: "Price Approval", section: S1 },

    { name: "customerId", label: "Customer", type: "select", options: customerOpts, section: S2, span: 2 },
    { name: "customerPic", label: "PIC Customer", section: S2 },
    { name: "salesId", label: "Sales", type: "select", options: userOpts, section: S2 },
    { name: "salesAdminId", label: "Sales Admin", type: "select", options: userOpts, section: S2 },
    { name: "branchId", label: "Branch", type: "select", options: branchOpts, section: S2 },

    { name: "includeDiInPrice", label: "Delivery & Install masuk harga", type: "checkbox", section: S3 },
    { name: "roundIdrOption", label: "Bulatkan IDR", type: "checkbox", section: S3 },

    { name: "franco", label: "Franco", type: "select", options: opts(FRANCO), section: S4 },
    { name: "franco_others", label: "Franco (lainnya)", type: "textarea", section: S4, span: 2 },
    { name: "delivery", label: "Delivery", type: "select", options: opts(DELIVERY), section: S4 },
    { name: "delivery_others", label: "Delivery (lainnya)", type: "textarea", section: S4, span: 2 },
    { name: "installation", label: "Installation", type: "select", options: opts(INSTALLATION), section: S4 },
    { name: "installation_others", label: "Installation (lainnya)", type: "textarea", section: S4, span: 2 },
    { name: "validity", label: "Validity", type: "select", options: opts(VALIDITY), section: S4 },
    { name: "warranty", label: "Warranty", type: "select", options: opts(WARRANTY), section: S4, span: 2 },
    { name: "warranty_others", label: "Warranty (lainnya)", type: "textarea", section: S4, span: 3 },
    { name: "payment", label: "Payment", type: "select", options: opts(PAYMENT), section: S4, span: 2 },
    { name: "payment_others", label: "Payment (lainnya)", type: "textarea", section: S4 },
    { name: "ppn", label: "PPN", type: "select", options: opts(PPN), section: S4 },

    { name: "qNotes", label: "Catatan (tampil di PDF)", type: "textarea", section: S5, span: 3 },
    { name: "catInternal", label: "Catatan Internal", type: "textarea", section: S5, span: 3 },
  ];
}

/** Flatten a quotation row into the form's value map (incl. terms_others jsonb). */
export function quotationValues(q: Record<string, unknown>): Record<string, unknown> {
  const others = (q.termsOthers as Record<string, string>) ?? {};
  return { ...q, ...others };
}
