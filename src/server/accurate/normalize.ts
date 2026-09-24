import type { AccurateResponse } from "./transport";
import type { CustomerDetail, CustomerSummary, DocumentDetail, DocumentKind, DocumentSummary, ItemDetail, ItemSummary, Paged } from "./types";
export type Row = Record<string, unknown>;
export const row = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
export const text = (value: unknown): string => typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
export const number = (value: unknown): number => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : 0;
const name = (value: unknown): string => text(row(value).name);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
function customFields(d: Row): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(d)) {
    if (/^(?:charField(?:[1-9]|1[0-5])|numericField(?:[1-9]|10)|dateField[12])$/.test(key) && value !== null && value !== undefined && text(value).trim()) result[key] = text(value);
  }
  return result;
}
export function normalizeDocument(value: unknown, kind: DocumentKind): DocumentSummary {
  const d = row(value); const partner = row(kind === "PO" ? d.vendor : d.customer);
  return { id: number(d.id), number: text(d.number), date: text(d.transDate), partnerName: text(partner.name) || text(d.vendorName) || text(d.customerName), status: text(d.statusName) || text(d.status) || text(d.approvalStatus), total: number(d.totalAmount), currency: text(row(d.currency).code) || name(d.currency) };
}
export function normalizeDocumentDetail(value: unknown, kind: DocumentKind, companyId: number): DocumentDetail {
  const d = row(value), partner = row(kind === "PO" ? d.vendor : d.customer);
  const summary = normalizeDocument(d, kind);
  const sourceWarnings: string[] = [];
  const hasTaxBase = d.percentTaxable !== null && d.percentTaxable !== undefined && Number.isFinite(Number(d.percentTaxable)) && number(d.percentTaxable) >= 0 && number(d.percentTaxable) <= 100;
  if (!hasTaxBase && d.taxable === true) sourceWarnings.push("Persentase dasar pajak sumber tidak tersedia; perhitungan salinan belum dapat dipastikan.");
  const checkDiscount = (percentage: unknown, amount: unknown, label: string) => {
    const value = text(percentage).trim();
    if (value && !/^\d+(?:\.\d+)?$/.test(value)) sourceWarnings.push(`Diskon bertingkat ${label} belum didukung dalam salinan draft.`);
    else if (number(amount) !== 0 && number(percentage) === 0) sourceWarnings.push(`Diskon nominal ${label} belum didukung dalam salinan draft.`);
  };
  checkDiscount(d.cashDiscPercent, d.cashDiscount, "dokumen");
  if (number(d.totalExpense) !== 0 || list(d.detailExpense).length) sourceWarnings.push("Biaya tambahan sumber belum didukung dalam salinan draft.");
  if ([d.tax2Amount, d.tax3Amount, d.tax4Amount].some(v => number(v) !== 0)) sourceWarnings.push("Pajak tambahan sumber belum didukung dalam salinan draft.");
  for (const [index, value] of list(d.detailItem).entries()) { const line = row(value); checkDiscount(line.itemDiscPercent, line.itemCashDiscount, `baris ${index + 1}`); }
  const dependencies: DocumentDetail["dependencies"] = [];
  for (const [key, label] of [["salesOrderList", "SO"], ["salesQuotationList", "SQ"], ["deliveryOrderList", "DO"], ["salesInvoiceList", "Faktur penjualan"], ["receiveItemList", "LPB"], ["purchaseInvoiceList", "Faktur pembelian"]]) {
    for (const entry of list(d[key])) { const ref = row(entry); if (ref.id || ref.number) dependencies.push({ kind: label, number: text(ref.number), id: number(ref.id) || undefined }); }
  }
  const historyLabels: Record<string, string> = { RI: "LPB", PI: "Faktur pembelian", DO: "DO", SI: "Faktur penjualan", SO: "SO", SQ: "SQ", SP: "Uang muka penjualan", PP: "Uang muka pembelian" };
  for (const entry of list(d.processHistory)) {
    const ref = row(entry), kind = text(ref.historyType), documentNumber = text(ref.historyNumber);
    if (documentNumber) dependencies.push({ kind: historyLabels[kind] || kind, number: documentNumber, id: number(ref.id) || undefined });
  }
  return { ...summary, companyId, kind,
    header: { partnerId: number(partner.id), partnerNo: text(partner.vendorNo || partner.customerNo || d.vendorNo || d.customerNo), shipDate: text(d.shipDate), toAddress: text(d.toAddress), description: text(d.description), poNumber: text(d.poNumber), branchName: name(d.branch) || text(d.branchName), branchId: number(d.branchId), customFields: customFields(d), paymentTerm: name(d.paymentTerm), currency: summary.currency, exchangeRate: number(d.rate), taxable: d.taxable === true, inclusiveTax: d.inclusiveTax === true, discountPercent: text(d.cashDiscPercent), discountAmount: number(d.cashDiscount), approvalStatus: text(d.approvalStatus) },
    lines: list(d.detailItem).map(value => {
      const l = row(value), item = row(l.item), tax = row(l.tax1 || l.tax);
      return { lineId: number(l.id), itemId: number(item.id || l.itemId), itemNo: text(item.no || l.itemNo), name: text(l.detailName || item.name), quantity: number(l.quantity), availableQuantity: l.availableQuantity == null ? null : number(l.availableQuantity), unit: name(l.itemUnit) || text(l.availableItemUnitName), unitPrice: number(l.unitPrice), discountPercent: text(l.itemDiscPercent), discountAmount: number(l.itemCashDiscount), total: number(l.totalPrice), taxName: text(l.detailTaxName) || text(tax.name), taxRate: l.useTax1 === true ? number(d.tax1Rate) : number(tax.rate), taxBasePercent: hasTaxBase ? number(d.percentTaxable) : 100, warehouseName: name(l.warehouse), projectName: name(l.project), departmentName: name(l.department), notes: text(l.detailNotes), customFields: customFields(l), brand: name(item.itemBrand), model: text(item.charField1), salespeople: list(l.salesmanList).map(name).filter(Boolean) };
    }), dependencies,
    sourceWarnings,
    dependencyCheck: { complete: false, reason: "Referensi dari detail Accurate bersifat parsial. Booking, picklist, dan seluruh dokumen turunan belum diperiksa; perubahan Accurate dinonaktifkan." },
  };
}
export function normalizeItem(value: unknown): ItemSummary {
  const d = row(value); const brand = name(d.itemBrand);
  return { id: number(d.id), no: text(d.no), name: text(d.name), brand: brand === "Root" ? "" : brand, model: text(d.charField1), unit: name(d.unit1) || name(d.itemUnit) || text(d.unit1Name), itemType: text(d.itemType), active: d.suspended !== true };
}
export function normalizeItemDetail(value: unknown): ItemDetail {
  const d = row(value); const units = [1, 2, 3, 4, 5].map(i => ({ name: name(d[`unit${i}`]) || text(d[`unit${i}Name`]), ratio: i === 1 ? 1 : number(d[`ratio${i}`]) })).filter(u => u.name);
  return { ...normalizeItem(d), category: name(d.itemCategory), description: text(d.notes), manageSerial: d.manageSN === true, serialType: text(d.serialNumberType), salesPrice: number(d.unitPrice || d.unitPrice1), purchasePrice: number(d.unitCost || d.cost), units, taxName: name(d.tax1), updatedAt: text(d.lastUpdate) };
}
export function normalizePage<T>(response: AccurateResponse<unknown>, transform: (value: unknown) => T, page: number): Paged<T> {
  const items = list(response.d).map(transform);
  return { items, page: number(response.sp?.page) || page, pageCount: number(response.sp?.pageCount) || (items.length ? 1 : 0), total: response.sp?.rowCount == null ? items.length : number(response.sp.rowCount) };
}

export function normalizeCustomer(value: unknown): CustomerSummary {
  const d = row(value);
  return { id: number(d.id), no: text(d.customerNo), name: text(d.name), email: text(d.email), phone: text(d.mobilePhone || d.workPhone), active: d.suspended !== true };
}
export function normalizeCustomerDetail(value: unknown): CustomerDetail {
  const d = row(value);
  return { ...normalizeCustomer(d), address: [d.billStreet, d.billCity, d.billProvince, d.billZipCode, d.billCountry].map(text).filter(Boolean).join(", "), contactName: text(d.contactName || d.contactInfoView) || list(d.detailContact).map(c => text(row(c).name)).filter(Boolean).join(", "), currency: text(row(d.currency).code) || name(d.currency), paymentTerm: name(d.term) || name(d.paymentTerm), taxNumber: text(d.npwpNo || d.taxNumber), notes: text(d.notes) };
}
