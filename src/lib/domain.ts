export const COMPANIES = [
  { id: 1, code: "GGS", name: "PT Gastro Gizi Sarana", shortName: "Gastro Gizi Sarana" },
  { id: 2, code: "RSP", name: "PT Resto Sarana Prima", shortName: "Resto Sarana Prima" },
  { id: 3, code: "SRI", name: "PT Sarana Refrigeratama", shortName: "Sarana Refrigeratama" },
] as const;
export type CompanyId = 1 | 2 | 3;
export const ROLES = ["sales", "head_sales", "importer", "head_importer", "master_admin"] as const;
export type Role = typeof ROLES[number];
export const ROLE_LABELS: Record<Role,string> = { sales:"Sales", head_sales:"Kepala Sales", importer:"Importer", head_importer:"Kepala Importer", master_admin:"Master Admin" };
export type Actor = { userId:string; name:string; role:Role; companyId:CompanyId; companyIds:CompanyId[]; teamId:string };
export type DraftKind = "PO" | "SQ" | "SO" | "ITEM_CREATE" | "ITEM_EDIT" | "CUSTOMER_CREATE" | "CUSTOMER_EDIT";
export type DraftStatus = "DRAFT" | "SUBMITTED" | "REVISION" | "APPROVED";
export const STATUS_LABELS: Record<DraftStatus,string> = {DRAFT:"Draft",SUBMITTED:"Menunggu persetujuan",REVISION:"Perlu revisi",APPROVED:"Disetujui secara internal"};
export const KIND_LABELS: Record<DraftKind,string> = { PO:"Purchase Order", SQ:"Sales Quotation", SO:"Sales Order", ITEM_CREATE:"Barang baru", ITEM_EDIT:"Perubahan barang", CUSTOMER_CREATE:"Klien baru", CUSTOMER_EDIT:"Perubahan klien" };
export type TransactionLine = { id:string; itemId:number; itemNo:string; name:string; unit:string; quantity:number; unitPrice:number; discountPercent:number; taxPercent:number; taxBasePercent?:number; warehouse:string; notes:string; project?:string; department?:string; customFields?:Record<string,string>; sourceLineId?:number };
export type TransactionPayload = { type:"transaction"; date:string; partnerId:number; partnerNo:string; partnerName:string; currency:string; exchangeRate:number; branch:string; paymentTerm:string; shipDate:string; address:string; reference:string; salesperson:string; description:string; discountPercent:number; inclusiveTax:boolean; lines:TransactionLine[]; customFields:Record<string,string> };
export type ItemPayload = { type:"item"; itemId?:number; no:string; name:string; itemType:string; category:string; brand:string; model:string; unit:string; manageSN:boolean; serialNumberType:string; active:boolean; salesPrice:number; purchasePrice:number; notes:string; customFields:Record<string,string> };
export type CustomerPayload = {type:"customer";customerId?:number;no:string;name:string;email:string;phone:string;address:string;contactName:string;currency:string;paymentTerm:string;taxNumber:string;active:boolean;notes:string};
export type DraftPayload = TransactionPayload | ItemPayload | CustomerPayload;
export type AccurateSource = { kind:"PO"|"SQ"|"SO"|"ITEM"|"CUSTOMER"; id:number; number:string; fingerprint:string };
export type Draft = { id:string; number:string; companyId:CompanyId; kind:DraftKind; status:DraftStatus; ownerId:string; ownerName:string; teamId:string; payload:DraftPayload; version:number; createdAt:string; updatedAt:string; source:AccurateSource|null; parentId:string|null; reason:string; approvedBy:string|null };
export type AuditEntry = { id:string; draftId:string; actorId:string; actorName:string; action:string; reason:string; at:string; before:Draft|null; after:Draft|null };
export type DraftAction = "submit"|"approve"|"revise"|"promote"|"demote"|"reopen";
export function isSalesRole(role:Role) { return role === "sales" || role === "head_sales"; }
export function canAccessKind(role:Role,kind:DraftKind) { return role === "master_admin" || (kind.startsWith("CUSTOMER") ? role === "head_sales" : kind.startsWith("ITEM") ? role === "head_importer" : (kind === "PO" ? !isSalesRole(role) : isSalesRole(role))); }
export function canReadAccurateKind(role:Role,kind:"PO"|"SQ"|"SO"|"ITEM") { return role === "master_admin" || kind === "ITEM" || (kind === "PO" ? !isSalesRole(role) : isSalesRole(role)); }
export function emptyTransaction(): TransactionPayload { return { type:"transaction",date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date()),partnerId:0,partnerNo:"",partnerName:"",currency:"IDR",exchangeRate:1,branch:"",paymentTerm:"",shipDate:"",address:"",reference:"",salesperson:"",description:"",discountPercent:0,inclusiveTax:false,lines:[],customFields:{} }; }
export function emptyItem():ItemPayload { return {type:"item",no:"",name:"",itemType:"INVENTORY",category:"",brand:"",model:"",unit:"",manageSN:false,serialNumberType:"",active:true,salesPrice:0,purchasePrice:0,notes:"",customFields:{}}; }
export function emptyCustomer():CustomerPayload { return {type:"customer",no:"",name:"",email:"",phone:"",address:"",contactName:"",currency:"IDR",paymentTerm:"",taxNumber:"",active:true,notes:""}; }
export function formatMoney(value:number,currency="IDR") { try{return new Intl.NumberFormat("id-ID",{style:"currency",currency,maximumFractionDigits:2}).format(value);}catch{return value.toLocaleString("id-ID");} }
