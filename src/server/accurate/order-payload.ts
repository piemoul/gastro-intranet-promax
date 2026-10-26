import type { Draft } from "../../lib/domain";
import { validateCompletePayload } from "../../lib/validation";
import { WorkflowError } from "../workflow";

const date=(value:string)=>value.split("-").reverse().join("/");
const unsupported=(message:string):never=>{throw new WorkflowError("PUBLICATION_FIELDS",message,422);};
/** Explicit mapping of documented save parameters; never forward arbitrary form keys. */
export function orderPayload(draft:Draft,marker:string):Record<string,string> {
  if (draft.kind!=="PO"&&draft.kind!=="SO"&&draft.kind!=="SQ") return unsupported("Hanya SQ, PO dan SO yang dapat diterbitkan.");
  const p=validateCompletePayload(draft.kind,draft.payload);
  if (p.type!=="transaction"||draft.source||p.lines.some(l=>l.sourceLineId!==undefined)) return unsupported("Dokumen sumber Accurate tidak dapat diterbitkan ulang sebagai dokumen baru.");
  if (Object.values(p.customFields).some(v=>v.trim())) return unsupported("Field tambahan header belum didukung API penerbitan. Hapus field tersebut dari draft atau proses dokumen langsung di Accurate.");
  if (draft.kind==="PO"&&p.salesperson) return unsupported("Salesperson tidak tersedia pada PO Accurate. Kosongkan isian tersebut.");
  const params:Record<string,string>={
    [draft.kind==="PO"?"vendorNo":"customerNo"]:p.partnerNo,
    transDate:date(p.date),currencyCode:p.currency,...(draft.kind!=="SQ"?{rate:String(p.exchangeRate)}:{}),
    cashDiscPercent:String(p.discountPercent),cashDiscount:"0",inclusiveTax:String(p.inclusiveTax),
    taxable:String(p.lines.some(l=>l.taxPercent>0)),
    description:[p.description,...(draft.kind==="SQ"&&p.sqDetails?Object.entries({Perihal:p.sqDetails.subject,PIC:p.sqDetails.pic,Validitas:p.sqDetails.validity,Pengiriman:p.sqDetails.delivery,Instalasi:p.sqDetails.installation,Garansi:p.sqDetails.warranty,Franco:p.sqDetails.franco}).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`):[]),draft.kind==="SQ"&&p.shipDate?`Rencana kirim: ${p.shipDate}`:"",draft.kind!=="SO"&&p.reference?`Referensi: ${p.reference}`:"",marker].filter(Boolean).join("\n"),
  };
  if(draft.kind==="PO")params.fillPriceByVendorPrice="false";
  for(const [key,value] of Object.entries({branchName:p.branch,paymentTermName:p.paymentTerm,shipDate:draft.kind!=="SQ"&&p.shipDate?date(p.shipDate):"",toAddress:p.address,...(draft.kind==="SO"?{poNumber:p.reference}:{})})) if(value) params[key]=value;
  for (const [index,line] of p.lines.entries()) {
    if(line.taxPercent>0&&(line.taxBasePercent??100)!==100) return unsupported(`Baris ${index+1}: DPP selain 100% belum didukung parameter API penerbitan. Proses dokumen ini langsung di Accurate; jangan mengubah DPP hanya agar lolos.`);
    const prefix=`detailItem[${index}].`;
    const values:Record<string,string>={itemNo:line.itemNo,detailName:line.name,itemUnitName:line.unit,quantity:String(line.quantity),unitPrice:String(line.unitPrice),itemDiscPercent:String(line.discountPercent),itemCashDiscount:"0",useTax1:String(line.taxPercent>0),useTax2:"false",useTax3:"false",...(draft.kind!=="SQ"?{warehouseName:line.warehouse}:{}),detailNotes:line.notes,projectNo:line.project||"",departmentName:line.department||""};
    if(draft.kind==="SO"&&draft.quotation)values.salesQuotationNumber=draft.quotation.number;
    if(draft.kind!=="PO"&&p.salesperson) values["salesmanListNumber[0]"]=p.salesperson;
    for(const [key,value] of Object.entries(line.customFields||{})) {
      if(!value.trim())continue;
      if(!/^dataClassification(?:[1-9]|10)Name$/.test(key))return unsupported(`Baris ${index+1}: field tambahan ${key} belum didukung API penerbitan.`);
      values[key]=value;
    }
    for (const [key,value] of Object.entries(values)) if(value!=="") params[prefix+key]=value;
  }
  return params;
}
