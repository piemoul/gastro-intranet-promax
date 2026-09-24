export type DocumentKind = "PO" | "SQ" | "SO";
export type Paged<T> = { items: T[]; page: number; pageCount: number; total: number };
export type DocumentSummary = { id: number; number: string; date: string; partnerName: string; status: string; total: number; currency: string };
export type DocumentLine = { lineId: number; itemId: number; itemNo: string; name: string; quantity: number; availableQuantity: number | null; unit: string; unitPrice: number; discountPercent: string; discountAmount: number; total: number; taxName: string; taxRate: number; taxBasePercent: number; warehouseName: string; projectName: string; departmentName: string; notes: string; customFields: Record<string, string>; brand: string; model: string; salespeople: string[] };
export type DocumentDetail = DocumentSummary & {
  companyId: number; kind: DocumentKind;
  header: { partnerId: number; partnerNo: string; shipDate: string; toAddress: string; description: string; poNumber: string; branchName: string; branchId: number; customFields: Record<string, string>; paymentTerm: string; currency: string; exchangeRate: number; taxable: boolean; inclusiveTax: boolean; discountPercent: string; discountAmount: number; approvalStatus: string };
  lines: DocumentLine[];
  dependencies: { kind: string; number: string; id?: number }[];
  sourceWarnings: string[];
  dependencyCheck: { complete: false; reason: string };
};
export type ItemSummary = { id: number; no: string; name: string; brand: string; model: string; unit: string; itemType: string; active: boolean };
export type ItemDetail = ItemSummary & { category: string; description: string; manageSerial: boolean; serialType: string; salesPrice: number; purchasePrice: number; units: { name: string; ratio: number }[]; taxName: string; updatedAt: string };
export type PartnerSummary = { id: number; no: string; name: string };

export type CustomerSummary = { id: number; no: string; name: string; email: string; phone: string; active: boolean };
export type CustomerDetail = CustomerSummary & { address: string; contactName: string; currency: string; paymentTerm: string; taxNumber: string; notes: string };
