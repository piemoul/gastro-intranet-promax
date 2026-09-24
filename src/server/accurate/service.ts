import { getReadTransport } from "./environment";
import { AccurateReadError, companyId, type ReadEndpoint } from "./transport";
import { normalizeCustomer, normalizeCustomerDetail, normalizeDocument, normalizeDocumentDetail, normalizeItem, normalizeItemDetail, normalizePage, number, row, text } from "./normalize";
import type { DocumentKind, PartnerSummary } from "./types";
import { itemChoices } from "@/lib/item-selection";
const MODULES = { PO: "purchase-order", SQ: "sales-quotation", SO: "sales-order" } as const;
function documentEndpoint(kind: DocumentKind, action: "list" | "detail"): ReadEndpoint {
  if (!Object.hasOwn(MODULES, kind)) throw new AccurateReadError("INVALID_INPUT", "Jenis dokumen tidak valid.");
  return `${MODULES[kind]}/${action}.do` as ReadEndpoint;
}
function pageNumber(page: number | undefined): number {
  if (page === undefined) return 1;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new AccurateReadError("INVALID_INPUT", "Halaman tidak valid.");
  return page;
}
function searchText(value = ""): string {
  if (typeof value !== "string" || value.length > 150) throw new AccurateReadError("INVALID_INPUT", "Pencarian maksimal 150 karakter.");
  return value.trim();
}
function positiveId(value: number) { if (!Number.isSafeInteger(value) || value < 1) throw new AccurateReadError("INVALID_INPUT", "ID Accurate tidak valid."); return value; }
export async function listDocuments(id: number, kind: DocumentKind, options: { search?: string; page?: number } = {}) {
  companyId(id); const endpoint = documentEndpoint(kind, "list"), page = pageNumber(options.page);
  const partner = kind === "PO" ? "vendor" : "customer";
  const response = await getReadTransport()<unknown>(id, endpoint, { fields: `id,number,transDate,${partner},statusName,status,totalAmount,currency`, keywords: searchText(options.search), "sp.page": page, "sp.pageSize": 20, "sp.sort": "transDate|desc;id|desc" });
  return normalizePage(response, value => normalizeDocument(value, kind), page);
}
export async function getDocument(id: number, kind: DocumentKind, documentId: number) {
  companyId(id); const response = await getReadTransport()<unknown>(id, documentEndpoint(kind, "detail"), { id: positiveId(documentId) });
  return normalizeDocumentDetail(response.d, kind, id);
}
export async function searchItems(id: number, search: string, pageInput?: number) {
  companyId(id); const page = pageNumber(pageInput);
  const response = await getReadTransport()<unknown>(id, "item/list.do", { fields: "id,no,name,itemBrand,charField1,unit1,itemType,suspended", keywords: searchText(search), "sp.page": page, "sp.pageSize": 20, "sp.sort": "name|asc" });
  return normalizePage(response, normalizeItem, page);
}
export async function getItem(id: number, itemId: number) {
  companyId(id); const response = await getReadTransport()<unknown>(id, "item/detail.do", { id: positiveId(itemId) });
  return normalizeItemDetail(response.d);
}
/** One page of live Accurate master data, scoped to the authenticated active company. */
export async function searchItemOptions(id: number, input: { search: string; brand: string; model: string; page?: number }) {
  companyId(id);
  const search = searchText(input.search), brand = searchText(input.brand), model = searchText(input.model), page = pageNumber(input.page);
  if (search.length < 2) return { brands: [], models: [], items: [], hasMore: false };
  const response = await getReadTransport()<unknown>(id, "item/list.do", {
    fields: "id,no,name,itemBrand,charField1,unit1,itemType,suspended",
    "filter.keywords.op": "CONTAIN", "filter.keywords.val": search,
    "filter.suspended": false, "sp.page": page, "sp.pageSize": 50, "sp.sort": "name|asc;id|asc",
  });
  if (!Array.isArray(response.d)) throw new AccurateReadError("UPSTREAM", "Daftar barang Accurate tidak valid.");
  const items = response.d.filter(value => row(value).suspended === false).map(normalizeItem);
  return { ...itemChoices(items, brand, model), hasMore: response.sp?.pageCount != null ? response.sp.pageCount > page : response.d.length >= 50 };
}
export async function searchPartners(id: number, kind: "customer" | "vendor", search: string): Promise<PartnerSummary[]> {
  companyId(id); if (kind !== "customer" && kind !== "vendor") throw new AccurateReadError("INVALID_INPUT", "Jenis relasi tidak valid.");
  const no = kind === "customer" ? "customerNo" : "vendorNo";
  const response = await getReadTransport()<unknown>(id, `${kind}/list.do`, { fields: `id,${no},name`, keywords: searchText(search), "sp.pageSize": 20, "sp.page": 1, "sp.sort": "name|asc" });
  if (!Array.isArray(response.d)) throw new AccurateReadError("UPSTREAM", "Daftar relasi Accurate tidak valid.");
  return response.d.map(value => { const d = row(value); return { id: number(d.id), no: text(d[no]), name: text(d.name) }; });
}

export async function searchCustomers(id: number, search: string, pageInput?: number) {
  companyId(id); const page = pageNumber(pageInput);
  const response = await getReadTransport()<unknown>(id, "customer/list.do", { fields: "id,customerNo,name,email,workPhone,mobilePhone,suspended", keywords: searchText(search), "sp.page": page, "sp.pageSize": 20, "sp.sort": "name|asc" });
  return normalizePage(response, normalizeCustomer, page);
}
export async function getCustomer(id: number, customerId: number) {
  companyId(id); const response = await getReadTransport()<unknown>(id, "customer/detail.do", { id: positiveId(customerId) });
  return normalizeCustomerDetail(response.d);
}

function uniqueExact<T extends { no: string }>(items: T[], no: string): T | null {
  const key = no.trim().toLocaleLowerCase("en-US");
  const matches = items.filter(item => item.no.trim().toLocaleLowerCase("en-US") === key);
  if (matches.length > 1) throw new AccurateReadError("UPSTREAM", "Kode master ditemukan lebih dari satu kali. Periksa data Accurate sebelum melanjutkan.");
  return matches[0] ?? null;
}
/** One filtered page. It never expands into a keyword search or whole-master scan. */
export async function findPartnerByNo(id: number, kind: "customer" | "vendor", no: string): Promise<PartnerSummary | null> {
  companyId(id); if (kind !== "customer" && kind !== "vendor") throw new AccurateReadError("INVALID_INPUT", "Jenis relasi tidak valid.");
  const exact = searchText(no); if (!exact) return null;
  const key = kind === "customer" ? "customerNo" : "vendorNo";
  const response = await getReadTransport()<unknown>(id, `${kind}/list.do`, { fields: `id,${key},name`, "filter.no.op": "EQUAL", "filter.no.val": exact, "sp.pageSize": 2, "sp.page": 1 });
  if (!Array.isArray(response.d)) throw new AccurateReadError("UPSTREAM", "Daftar relasi Accurate tidak valid.");
  return uniqueExact(response.d.map(value => { const d = row(value); return { id: number(d.id), no: text(d[key]), name: text(d.name) }; }), exact);
}
export async function findItemByNo(id: number, no: string) {
  companyId(id); const exact = searchText(no); if (!exact) return null;
  const response = await getReadTransport()<unknown>(id, "item/list.do", { fields: "id,no,name,itemBrand,charField1,unit1,itemType,suspended", "filter.no.op": "EQUAL", "filter.no.val": exact, "sp.pageSize": 2, "sp.page": 1 });
  if (!Array.isArray(response.d)) throw new AccurateReadError("UPSTREAM", "Daftar barang Accurate tidak valid.");
  return uniqueExact(response.d.map(normalizeItem), exact);
}
export async function findCustomerByNo(id: number, no: string) {
  companyId(id); const exact = searchText(no); if (!exact) return null;
  const response = await getReadTransport()<unknown>(id, "customer/list.do", { fields: "id,customerNo,name,email,workPhone,mobilePhone,suspended", "filter.no.op": "EQUAL", "filter.no.val": exact, "sp.pageSize": 2, "sp.page": 1 });
  if (!Array.isArray(response.d)) throw new AccurateReadError("UPSTREAM", "Daftar klien Accurate tidak valid.");
  return uniqueExact(response.d.map(normalizeCustomer), exact);
}

/** Fetch every page of the small warehouse master; never return a silently truncated list. */
export async function getWarehouses(id:number):Promise<{id:number;name:string}[]> {
  companyId(id);
  const read=getReadTransport(),warehouses=new Map<number,{id:number;name:string}>();
  for(let page=1;page<=50;page++) {
    const response=await read<unknown[]>(id,"warehouse/list.do",{fields:"id,name,suspended","sp.pageSize":100,"sp.page":page,"sp.sort":"name|asc;id|asc"});
    if(!Array.isArray(response.d))throw new AccurateReadError("UPSTREAM","Daftar gudang Accurate tidak valid.");
    for(const value of response.d) {
      const w=row(value);
      if(w.suspended===false&&Number.isSafeInteger(w.id)&&Number(w.id)>0&&typeof w.name==="string"&&w.name.trim())warehouses.set(Number(w.id),{id:Number(w.id),name:w.name});
    }
    if(response.sp?.pageCount!==undefined?page>=response.sp.pageCount:response.d.length<100)return [...warehouses.values()];
  }
  throw new AccurateReadError("UPSTREAM","Daftar gudang terlalu besar untuk dimuat seluruhnya. Hubungi admin.");
}
