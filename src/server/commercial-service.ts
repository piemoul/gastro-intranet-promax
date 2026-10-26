import { createHash } from "node:crypto";
import { estimateTransaction } from "@/lib/calculations";
import "server-only";
import type { Actor,Draft,TransactionPayload } from "@/lib/domain";
import { defaultSettings,defaultQuoteOptions,managedItemSchema,settingsSchema,mappingSchema,followupSchema,itemCost,quotedItemPrice,convertPrice,type ManagedItem } from "@/lib/commercial";
import { getCommercialStore,type CommercialRecord } from "./commercial-store";
import { getItem } from "./accurate";
import { getStore } from "./store";
import { assertEdit,WorkflowError } from "./workflow";
import { wmsCatalog } from "./integrations/reference-api";
import { getReadTransport } from "./accurate/environment";
import { list,row,text,number } from "./accurate/normalize";
export function assertReviewer(actor:Actor){if(!["master_admin","head_sales","head_importer"].includes(actor.role))throw new WorkflowError("FORBIDDEN","Fungsi ini hanya untuk reviewer.",403);}
export function assertSuper(actor:Actor){if(actor.role!=="master_admin")throw new WorkflowError("FORBIDDEN","Fungsi ini hanya untuk Super Admin.",403);}
export async function commercialSettings(actor:Actor){const record=await getCommercialStore().get(actor,"SETTINGS","default");return {record,settings:record?settingsSchema.parse(record.data):defaultSettings()};}
export async function saveManagedItem(actor:Actor,id:number,version:number,raw:unknown){
  assertSuper(actor);const data=managedItemSchema.parse(raw),item=await getItem(actor.companyId,id);
  if(!item.active||item.id!==id||data.accurateId!==id||data.accurateNo!==item.no)throw new WorkflowError("SKU_CHANGED","Pilih ulang SKU Accurate PT aktif.",409);
  // Canonical identity is always refreshed; text in a request cannot invent another product.
  if(data.supplier.id){const r=row((await getReadTransport()(actor.companyId,"vendor/detail.do",{id:data.supplier.id})).d);if(number(r.id)!==data.supplier.id||r.suspended===true||text(r.vendorNo)!==data.supplier.no)throw new WorkflowError("SUPPLIER_CHANGED","Supplier tidak sesuai PT aktif.",409);data.supplier.name=text(r.name);}else{data.supplier.no="";data.supplier.name="";}
  return getCommercialStore().save(actor,"ITEM",String(id),version,{...data,name:item.name,brand:item.brand,model:item.model,unit:item.unit});
}
export async function saveSkuMapping(actor:Actor,version:number,raw:unknown){
  assertSuper(actor);const p=mappingSchema.parse(raw),source=await wmsCatalog(actor.companyId,{code:p.wmsCode});
  if(source.items.filter(x=>x.id===p.wmsId&&x.code===p.wmsCode).length!==1)throw new WorkflowError("WMS_ITEM_CHANGED","SKU WMS PT aktif tidak ditemukan.",409);
  const item=await getItem(actor.companyId,p.accurateId);if(!item.active||item.id!==p.accurateId||item.no!==p.accurateNo)throw new WorkflowError("SKU_CHANGED","SKU Accurate PT aktif tidak cocok.",409);
  return getCommercialStore().save(actor,"SKU_MAP",p.wmsId,version,p);
}
export async function referenceOptions(actor:Actor){
  const transport=getReadTransport();
  const read=async(endpoint:"branch/list.do"|"currency/list.do"|"payment-term/list.do")=>{
    const items:{id:number;name:string;code:string}[]=[];
    for(let page=1;page<=20;page++){const r=await transport(actor.companyId,endpoint,{fields:"id,name,code,suspended","sp.page":page,"sp.pageSize":100});for(const raw of list(r.d)){const x=row(raw);if(x.suspended!==true)items.push({id:number(x.id),name:text(x.name)||text(x.code),code:text(x.code)});}if(page>=Number(r.sp?.pageCount||1))break;}
    return items;
  };
  const result=await Promise.allSettled([read("branch/list.do"),read("currency/list.do"),read("payment-term/list.do")]);
  return {branches:result[0].status==="fulfilled"?result[0].value:[],currencies:result[1].status==="fulfilled"?result[1].value:[],paymentTerms:result[2].status==="fulfilled"?result[2].value:[],warnings:result.flatMap((r,i)=>r.status==="rejected"?[`${["Cabang","Mata uang","Termin"][i]} Accurate belum dapat dibaca. Periksa izin API PT aktif.`]:[])};
}
export async function applyPricebook(actor:Actor,id:string,version:number,choices:{lineId:string;tier:number}[]){
  assertReviewer(actor);const store=getStore(),draft=await store.get(actor,id);assertEdit(actor,draft);
  if(draft.kind!=="SQ"||draft.payload.type!=="transaction")throw new WorkflowError("INVALID_KIND","Pricebook digunakan pada SQ.");
  if(draft.version!==version)throw new WorkflowError("VERSION_CONFLICT","Draft sudah berubah.",409);
  const p=structuredClone(draft.payload),options=p.quoteOptions??defaultQuoteOptions(),{settings}=await commercialSettings(actor);
  for(const choice of choices){const line=p.lines.find(l=>l.id===choice.lineId);if(!line)throw new WorkflowError("LINE_CHANGED","Baris barang tidak ditemukan.",409);
    const record=await getCommercialStore().get(actor,"ITEM",String(line.itemId));if(!record)throw new WorkflowError("PRICEBOOK_REQUIRED",`Isi Manage Items untuk ${line.itemNo} terlebih dahulu.`,409);
    const item=managedItemSchema.parse(record.data);if(item.accurateNo!==line.itemNo)throw new WorkflowError("SKU_CHANGED","Identitas pricebook berubah.",409);
    const q=quotedItemPrice(item,settings,{tier:choice.tier,currency:p.currency,branch:p.branch,mode:options.deliveryMode,rounding:options.rounding,date:p.date});
    const accurate=await getItem(actor.companyId,line.itemId);
    if(!accurate.active||accurate.id!==line.itemId||accurate.no!==line.itemNo)throw new WorkflowError("SKU_CHANGED","Master SKU berubah. Pilih ulang barang.",409);
    line.unitPrice=q.price;line.taxPercent=accurate.taxRate??line.taxPercent;line.taxBasePercent=accurate.taxBasePercent??100;
    line.pricing={itemKey:String(line.itemId),version:record.version,tier:choice.tier,base:q.base,delivery:q.delivery,installation:q.installation,mode:options.deliveryMode,currency:p.currency,rates:{...settings.rates}};
  }
  p.sqDetails={subject:"",pic:"",validity:"",delivery:"",installation:"",warranty:"",franco:"",...p.sqDetails,pricingReviewed:false};
  return store.update(actor,id,{version,payload:p,reason:"Harga diterapkan dari Manage Items"});
}
export async function validateCommercialQuote(actor:Actor,draft:Draft){
  if(draft.kind!=="SQ"||draft.payload.type!=="transaction")return;
  const p=draft.payload,{settings}=await commercialSettings(actor),options=p.quoteOptions??defaultQuoteOptions();
  for(const line of p.lines){
    const record=await getCommercialStore().get(actor,"ITEM",String(line.itemId));
    if(!line.pricing){if(record&&(record.data as ManagedItem).active)throw new WorkflowError("PRICEBOOK_REQUIRED",`Terapkan pricebook ${line.itemNo} sebelum persetujuan.`,409);continue;}
    if(!record||record.version!==line.pricing.version||line.pricing.itemKey!==String(line.itemId))throw new WorkflowError("PRICEBOOK_CHANGED",`Pricebook ${line.itemNo} berubah. Terapkan ulang harga dan review SQ.`,409);
    const item=managedItemSchema.parse(record.data),q=quotedItemPrice(item,settings,{tier:line.pricing.tier,currency:p.currency,branch:p.branch,mode:options.deliveryMode,rounding:options.rounding,date:p.date});
    if(JSON.stringify(line.pricing.rates)!==JSON.stringify(settings.rates)||line.pricing.base!==q.base||line.pricing.delivery!==q.delivery||line.pricing.installation!==q.installation||line.pricing.currency!==p.currency||line.pricing.mode!==options.deliveryMode)throw new WorkflowError("PRICEBOOK_CHANGED","Kurs, cabang atau komponen harga berubah. Terapkan ulang pricebook.",409);
    const floor=item.tiers[0];if(floor!=null&&(line.unitPrice*(1-line.discountPercent/100)*(1-p.discountPercent/100)-line.pricing.delivery-line.pricing.installation)<convertPrice(floor,item.currency,p.currency,settings.rates)&&!options.exceptionReason.trim())throw new WorkflowError("PRICE_EXCEPTION_REQUIRED",`${line.itemNo} di bawah Tier 0. Isi alasan pengecualian untuk persetujuan Super Admin.`,409);
  }
}
export async function pricingAnalysis(actor:Actor,draft:Draft){
  assertReviewer(actor);if(draft.payload.type!=="transaction")throw new WorkflowError("INVALID_KIND","Bukan dokumen transaksi.");
  const {settings}=await commercialSettings(actor),p=draft.payload,estimate=estimateTransaction(draft.payload);
  const lines=[];for(const line of p.lines){let cost:number|null=null;let historical:CommercialRecord|null=null;
    if(line.pricing)historical=await getCommercialStore().atVersion(actor,String(line.itemId),line.pricing.version);
    if(historical){const item=managedItemSchema.parse(historical.data);cost=itemCost(item,p.currency,line.pricing?.rates||settings.rates)+(line.pricing?.delivery||0)+(line.pricing?.installation||0);}
    const estimated=estimate.lines.find(l=>l.id===line.id)!;const revenue=estimated.total-estimated.tax;
    const cogs=cost===null?null:cost*line.quantity;lines.push({id:line.id,name:line.name,itemNo:line.itemNo,revenue,cogs,profit:cogs===null?null:revenue-cogs,margin:cogs===null||!revenue?null:(revenue-cogs)/revenue*100,pricebookVersion:line.pricing?.version??null});
  }return {currency:p.currency,lines,revenue:lines.reduce((a,l)=>a+l.revenue,0),knownCogs:lines.reduce((a,l)=>a+(l.cogs??0),0),complete:lines.every(l=>l.cogs!==null)};
}
export async function duplicateQuote(actor:Actor,id:string,version:number,requestId:string){
  const original=await getStore().get(actor,id);if(original.version!==version)throw new WorkflowError("VERSION_CONFLICT","Dokumen sumber berubah.",409);
  if(original.kind!=="SQ"||original.payload.type!=="transaction")throw new WorkflowError("INVALID_KIND","Duplikasi/revisi berlaku untuk SQ.");
  let p:TransactionPayload=structuredClone(original.payload);p.lines=p.lines.map(l=>({...l,id:`copy-${createHash("sha256").update(`${original.id}:${l.id}:${requestId}`).digest("hex").slice(0,32)}`,sourceLineId:undefined}));
  p.quoteOptions={...defaultQuoteOptions(),...p.quoteOptions,originDraftId:original.id,originNumber:original.publication?.accurateNumber||original.number};
  if(actor.role==="sales"){
    const {emptyTransaction}=await import("@/lib/domain");p={...emptyTransaction(),partnerId:p.partnerId,partnerNo:p.partnerNo,partnerName:p.partnerName,description:p.description,lines:p.lines.map(l=>({...l,unitPrice:0,discountPercent:0,taxPercent:0,taxBasePercent:100,warehouse:"",pricing:undefined,project:"",department:"",customFields:{}}))};
  }else if(p.sqDetails)p.sqDetails.pricingReviewed=false;
  return getStore().create(actor,{kind:"SQ",payload:p,requestId,reason:`Revisi/duplikasi lokal dari ${original.number}; dokumen Accurate asal tidak diubah.`});
}
export async function saveFollowup(actor:Actor,id:string,version:number,raw:unknown){const draft=await getStore().get(actor,id);if(draft.kind!=="SQ")throw new WorkflowError("INVALID_KIND","Tindak lanjut hanya untuk SQ.");const data=followupSchema.parse({...raw as object,ownerId:draft.ownerId,teamId:draft.teamId});return getCommercialStore().save(actor,"FOLLOWUP",id,version,data);}
