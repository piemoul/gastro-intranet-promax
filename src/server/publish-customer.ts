import { referenceOptions } from "./commercial-service";
import "server-only";
import type { Actor,Draft } from "@/lib/domain";
import { validateCompletePayload } from "@/lib/validation";
import { getStore } from "./store";
import { assertPublish,WorkflowError } from "./workflow";
import { findCustomerByNo } from "./accurate";
import { getReadTransport,getCustomerCreateTransport } from "./accurate/environment";
import type { NewCustomerBody } from "./accurate/customer-create-transport";
import { AccurateCreateError } from "./accurate/create-transport";
import { row,list,text,number } from "./accurate/normalize";

export function customerCreateBody(draft:Draft,marker:string):NewCustomerBody{
  if(draft.kind!=="CUSTOMER_CREATE"||draft.source)throw new WorkflowError("PUBLICATION_KIND","Hanya draft klien baru yang dapat diterbitkan.",409);
  const p=validateCompletePayload("CUSTOMER_CREATE",draft.payload);
  if(p.type!=="customer"||p.customerId||!p.active)throw new WorkflowError("CUSTOMER_CREATE_ONLY","Klien harus baru dan aktif; master yang sudah ada tidak dapat ditulis.",409);
  if(!/^[A-Za-z0-9._/-]{1,100}$/.test(p.no))throw new WorkflowError("CLIENT_CODE","Gunakan kode klien huruf/angka, titik, garis atau underscore.",400);
  const profile=p.profile;
  const contacts=profile?.contacts.map(c=>({name:c.name,position:c.position,email:c.email,mobilePhone:c.phone}))??[];
  if(p.contactName&&!contacts.some(c=>c.name===p.contactName))contacts.unshift({name:p.contactName,position:"",email:p.email,mobilePhone:p.phone});
  return {customerNo:p.no,name:p.name,transDate:p.date!.split("-").reverse().join("/"),currencyCode:p.currency,email:p.email,workPhone:p.phone,billStreet:p.address,billCity:profile?.city||"",billProvince:profile?.province||"",billCountry:profile?.country||"",billZipCode:profile?.zipCode||"",termName:p.paymentTerm,wpNumber:p.taxNumber,branchName:profile?.branch||"",categoryName:profile?.category||"",salesmanNumber:profile?.salesperson||"",description:[profile?.alias?`Alias: ${profile.alias}`:"",profile?.group?`Group: ${profile.group}`:""].filter(Boolean).join("\n"),notes:[p.notes,marker].filter(Boolean).join("\n"),detailContact:contacts};
}
export async function verifyCustomer(draft:Draft,id:number,code:string){
  if(!draft.publication)throw new AccurateCreateError(true,"Reservasi klien tidak ditemukan.");
  const expected=customerCreateBody(draft,draft.publication.marker),r=row((await getReadTransport()(draft.companyId,"customer/detail.do",{id})).d);
  const currency=text(row(r.currency).code)||text(r.currencyCode),contacts=list(r.detailContact).map(row);
  if(number(r.id)!==id||text(r.customerNo)!==code||code!==expected.customerNo||text(r.name)!==expected.name||currency!==expected.currencyCode||!text(r.notes).split("\n").includes(draft.publication.marker)||text(r.email)!==expected.email||text(r.billStreet)!==expected.billStreet||expected.detailContact.some(c=>!contacts.some(a=>text(a.name)===c.name&&text(a.email)===c.email&&text(a.mobilePhone)===c.mobilePhone)))throw new AccurateCreateError(true,"Klien ditemukan, tetapi identitas/kontak/penanda belum cocok. Periksa Accurate; pengiriman ulang dikunci.");
  return {id,number:code};
}
export async function publishCustomer(actor:Actor,id:string,version:number,dependencies:{store?:ReturnType<typeof getStore>;create?:ReturnType<typeof getCustomerCreateTransport>;preflight?:(draft:Draft)=>Promise<void>;verify?:typeof verifyCustomer}={}){
  const store=dependencies.store??getStore(),before=await store.get(actor,id);assertPublish(actor,before);
  if(before.version!==version)throw new WorkflowError("VERSION_CONFLICT","Draft klien sudah berubah.",409);
  const body=customerCreateBody(before,"preflight");
  if(dependencies.preflight)await dependencies.preflight(before);else {
    if(await findCustomerByNo(actor.companyId,body.customerNo))throw new WorkflowError("CUSTOMER_EXISTS","Kode klien sudah ada di Accurate. Pilih klien tersebut; jangan membuat ulang.",409);
    const refs=await referenceOptions(actor);if(!refs.currencies.some(c=>c.code===body.currencyCode))throw new WorkflowError("CUSTOMER_REFERENCE","Mata uang klien belum tervalidasi di Accurate. Periksa izin currency_view.",409);
    if(body.branchName&&!refs.branches.some(b=>b.name===body.branchName))throw new WorkflowError("CUSTOMER_REFERENCE","Cabang klien belum tervalidasi di Accurate.",409);
    if(body.termName&&!refs.paymentTerms.some(t=>t.name===body.termName))throw new WorkflowError("CUSTOMER_REFERENCE","Termin klien belum tervalidasi di Accurate.",409);
  }
  const reserved=await store.reservePublication(actor,id,version),attempt=reserved.publication!.attemptId;
  try{
    const result=await(dependencies.create??getCustomerCreateTransport())(actor.companyId,customerCreateBody(reserved,reserved.publication!.marker));
    try{await(dependencies.verify??verifyCustomer)(reserved,result.id,result.number);}catch{return store.completePublication(actor,id,attempt,{outcome:"uncertain",error:`Kode ${result.number} diterima, tetapi verifikasi belum cocok. Periksa melalui rekonsiliasi.`});}
    return store.completePublication(actor,id,attempt,{outcome:"published",...result});
  }catch(e){return store.completePublication(actor,id,attempt,{outcome:e instanceof AccurateCreateError&&!e.uncertain?"rejected":"uncertain",error:e instanceof AccurateCreateError?e.message:"Hasil pembuatan klien belum pasti. Pengiriman ulang dikunci."});}
}
export async function reconcileCustomer(actor:Actor,id:string,version:number,code:string){
  if(actor.role!=="master_admin")throw new WorkflowError("FORBIDDEN","Rekonsiliasi klien hanya untuk Super Admin.",403);
  const store=getStore(),draft=await store.get(actor,id);
  if(draft.kind!=="CUSTOMER_CREATE"||!draft.publication||!["PUBLISHING","UNCERTAIN"].includes(draft.status)||draft.version!==version)throw new WorkflowError("PUBLICATION_CONFLICT","Muat ulang status klien.",409);
  const found=await findCustomerByNo(actor.companyId,code);if(!found)throw new WorkflowError("NOT_FOUND","Klien belum ditemukan; pengiriman ulang tetap terkunci.",409);
  const result=await verifyCustomer(draft,found.id,code);return store.completePublication(actor,id,draft.publication.attemptId,{outcome:"published",...result});
}
