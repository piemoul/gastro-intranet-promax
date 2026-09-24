import { z } from "zod";
import type { AccurateSource, DraftKind, DraftPayload } from "./domain";

const text = z.string().max(500).trim();
const note = z.string().max(5000).trim();
const amount = z.number().finite().min(0).max(1_000_000_000_000);
const percent = z.number().finite().min(0).max(100);
const customFields = z.record(z.string().min(1).max(100), z.string().max(2000)).refine(value => Object.keys(value).length <= 50, "Maksimal 50 field tambahan.");
const date = z.string().refine(value => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), "Tanggal tidak valid.");

export const transactionLineSchema = z.object({
  id: z.string().min(1).max(100), itemId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  itemNo: text, name: text, unit: text, quantity: z.number().finite().min(0).max(1_000_000_000),
  unitPrice: amount, discountPercent: percent, taxPercent: percent, taxBasePercent:percent.default(100), warehouse: text, notes: note,
  project:text.optional().default(""), department:text.optional().default(""), customFields:customFields.optional().default({}),
  sourceLineId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();

export const transactionPayloadSchema = z.object({
  type: z.literal("transaction"), date, partnerId: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  partnerNo: text, partnerName: text, currency: z.string().regex(/^[A-Z]{3}$/, "Gunakan kode mata uang tiga huruf."),
  exchangeRate: z.number().finite().positive().max(1_000_000_000), branch: text, paymentTerm: text,
  shipDate: date, address: note, reference: text, salesperson: text, description: note,
  discountPercent: percent, inclusiveTax: z.boolean(), lines: z.array(transactionLineSchema).max(500), customFields,
}).strict().refine(value => new Set(value.lines.map(line => line.id)).size === value.lines.length, "ID baris harus unik.")
  .refine(value => {const sourceIds=value.lines.flatMap(line=>line.sourceLineId?[line.sourceLineId]:[]);return new Set(sourceIds).size===sourceIds.length;},"Referensi baris Accurate harus unik.");

export const itemPayloadSchema = z.object({
  type: z.literal("item"), itemId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  no: text, name: text, itemType: z.enum(["INVENTORY", "NON_INVENTORY", "SERVICE", "GROUP"]),
  category: text, brand: text, model: text, unit: text, manageSN: z.boolean(), serialNumberType: text,
  active: z.boolean(), salesPrice: amount, purchasePrice: amount, notes: note, customFields,
}).strict();

export const customerPayloadSchema = z.object({
  type:z.literal("customer"), customerId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  no:text, name:text, email:z.string().trim().max(254).refine(value => value === "" || z.email().safeParse(value).success,"Alamat email tidak valid."),
  phone:text, address:note, contactName:text, currency:z.string().regex(/^[A-Z]{3}$/), paymentTerm:text,
  taxNumber:text, active:z.boolean(), notes:note,
}).strict();

export const draftKindSchema = z.enum(["PO", "SQ", "SO", "ITEM_CREATE", "ITEM_EDIT", "CUSTOMER_CREATE", "CUSTOMER_EDIT"]);
export const draftActionSchema = z.enum(["submit", "approve", "revise", "promote", "demote", "reopen"]);
export const versionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const reasonSchema = z.string().trim().max(2000);
export const accurateSourceSchema = z.object({ kind:z.enum(["PO", "SQ", "SO", "ITEM", "CUSTOMER"]), id:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), number:text, fingerprint:z.string().min(1).max(256) }).strict();

/** Partial drafts may omit business values but never allow malformed IDs or unsafe numeric values. */
export function parseDraftPayload(kind: DraftKind, input: unknown): DraftPayload {
  const payload = kind.startsWith("ITEM") ? itemPayloadSchema.parse(input) : kind.startsWith("CUSTOMER") ? customerPayloadSchema.parse(input) : transactionPayloadSchema.parse(input);
  if (kind === "ITEM_EDIT" && payload.type === "item" && !payload.itemId) throw new z.ZodError([{ code:"custom", path:["itemId"], message:"Pilih barang Accurate untuk perubahan master." }]);
  if (kind === "ITEM_CREATE" && payload.type === "item" && payload.itemId) throw new z.ZodError([{ code:"custom", path:["itemId"], message:"Draft barang baru tidak boleh menggunakan ID barang lama." }]);
  if (kind === "CUSTOMER_EDIT" && payload.type === "customer" && !payload.customerId) throw new z.ZodError([{code:"custom",path:["customerId"],message:"Pilih klien Accurate untuk perubahan master."}]);
  if (kind === "CUSTOMER_CREATE" && payload.type === "customer" && payload.customerId) throw new z.ZodError([{code:"custom",path:["customerId"],message:"Draft klien baru tidak boleh menggunakan ID klien lama."}]);
  return payload;
}

export function validateCompletePayload(kind: DraftKind, input: unknown): DraftPayload {
  const payload = parseDraftPayload(kind, input);
  const issues: { code:"custom"; path:(string|number)[]; message:string }[] = [];
  const requireText = (value:string, path:(string|number)[], message:string) => { if (!value.trim()) issues.push({code:"custom",path,message}); };
  if (payload.type === "transaction") {
    requireText(payload.date, ["date"], "Tanggal diperlukan.");
    if (!payload.partnerId) issues.push({code:"custom",path:["partnerId"],message:"Pilih pelanggan atau pemasok Accurate."});
    requireText(payload.partnerName,["partnerName"],"Nama pelanggan atau pemasok diperlukan.");
    if (!payload.lines.length) issues.push({code:"custom",path:["lines"],message:"Tambahkan minimal satu barang Accurate."});
    payload.lines.forEach((line,index) => {
      requireText(line.itemNo,["lines",index,"itemNo"],"Kode barang diperlukan.");
      requireText(line.name,["lines",index,"name"],"Nama barang diperlukan.");
      requireText(line.unit,["lines",index,"unit"],"Satuan diperlukan.");
      if (line.quantity <= 0) issues.push({code:"custom",path:["lines",index,"quantity"],message:"Jumlah harus lebih dari nol."});
    });
  } else if (payload.type === "item") {
    requireText(payload.no,["no"],"Kode barang diperlukan.");
    requireText(payload.name,["name"],"Nama barang diperlukan.");
    requireText(payload.unit,["unit"],"Satuan utama diperlukan.");
    if (payload.manageSN) requireText(payload.serialNumberType,["serialNumberType"],"Tipe nomor serial diperlukan.");
  } else {
    requireText(payload.no,["no"],"Kode klien diperlukan.");
    requireText(payload.name,["name"],"Nama klien diperlukan.");
  }
  if (issues.length) throw new z.ZodError(issues);
  return payload;
}

export function parseAccurateSource(kind:DraftKind, input:unknown):AccurateSource {
  const source = accurateSourceSchema.parse(input);
  const expected = kind === "ITEM_EDIT" ? "ITEM" : kind === "CUSTOMER_EDIT" ? "CUSTOMER" : kind;
  if (source.kind !== expected) throw new z.ZodError([{code:"custom",path:["source","kind"],message:"Referensi Accurate tidak sesuai jenis draft."}]);
  return source;
}
