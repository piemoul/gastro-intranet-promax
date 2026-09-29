import "server-only";
import { validateOrderQuotation } from "./quotation";
import type { Actor, Draft } from "../lib/domain";
import { estimateTransaction } from "../lib/calculations";
import { getStore } from "./store";
import { assertDraftAccess, assertPublish, isHeadForKind, WorkflowError } from "./workflow";
import { validateAccurateReferences } from "./draft-sources";
import { getOrderCreateTransport, getReadTransport } from "./accurate/environment";
import { AccurateCreateError } from "./accurate/create-transport";
import { orderPayload } from "./accurate/order-payload";
import { normalizeDocumentDetail, row } from "./accurate/normalize";

type Store=ReturnType<typeof getStore>;
const moduleFor=(draft:Draft)=>draft.kind==="PO"?"purchase-order":draft.kind==="SQ"?"sales-quotation":"sales-order";
export async function checkPublicationReferences(actor:Actor,draft:Draft) {
  await validateAccurateReferences(actor,draft.kind,draft.payload);
  await validateOrderQuotation(actor,draft);
  if(draft.payload.type!=="transaction")return;
  const taxed=new Map(draft.payload.lines.filter(l=>l.taxPercent>0).map(l=>[l.itemId,l]));
  for(const line of taxed.values()) {
    const item=row((await getReadTransport()(actor.companyId,"item/detail.do",{id:line.itemId})).d);
    const tax=row(item.tax1);
    if(typeof tax.rate!=="number"||draft.payload.lines.some(l=>l.itemId===line.itemId&&l.taxPercent>0&&l.taxPercent!==tax.rate)) throw new WorkflowError("PUBLICATION_TAX",`Pajak ${line.itemNo} harus sesuai tarif master Accurate (${tax.rate??"tidak tersedia"}%). Tinjau dan setujui kembali draft.`,422);
  }
}

/** Read-back verifies identity and commercial values before recording publication success. */
export async function verifyPublishedOrder(draft:Draft,id:number,documentNumber:string) {
  const raw=row((await getReadTransport()(draft.companyId,`${moduleFor(draft)}/detail.do`,{id})).d);
  const doc=normalizeDocumentDetail(raw,draft.kind as "PO"|"SO"|"SQ",draft.companyId),p=draft.payload;
  const fail=()=>{throw new AccurateCreateError(true,"Dokumen ditemukan, tetapi isinya belum cocok dengan draft. Periksa dokumen Accurate sebelum melanjutkan.");};
  if(p.type!=="transaction"||!draft.publication)return fail();
  if(doc.id!==id||doc.number!==documentNumber||!doc.header.description.split("\n").includes(draft.publication.marker)||doc.header.partnerId!==p.partnerId||doc.header.partnerNo!==p.partnerNo||doc.currency!==p.currency||doc.lines.length!==p.lines.length||(draft.kind!=="SQ"&&doc.header.exchangeRate!==p.exchangeRate)||doc.header.inclusiveTax!==p.inclusiveTax||Number(doc.header.discountPercent||0)!==p.discountPercent) return fail();
  const expected=[...p.lines];
  for(const actual of doc.lines) {
    const index=expected.findIndex(l=>l.itemId===actual.itemId&&l.itemNo===actual.itemNo&&l.unit===actual.unit&&l.quantity===actual.quantity&&l.unitPrice===actual.unitPrice&&(draft.kind==="SQ"||!l.warehouse||l.warehouse===actual.warehouseName)&&l.discountPercent===Number(actual.discountPercent||0));
    if(index<0)return fail();expected.splice(index,1);
  }
  const estimate=estimateTransaction(p);
  if(Math.abs(doc.total-estimate.total)>0.02*(p.lines.length+1))return fail();
  return {id:doc.id,number:doc.number};
}

export async function publishOrder(actor:Actor,id:string,version:number,dependencies:{store?:Store;preflight?:typeof checkPublicationReferences;create?:ReturnType<typeof getOrderCreateTransport>;verify?:typeof verifyPublishedOrder}={}) {
  const store=dependencies.store??getStore(),before=await store.get(actor,id);
  assertPublish(actor,before);
  if(before.version!==version)throw new WorkflowError("VERSION_CONFLICT","Draft telah berubah. Muat ulang sebelum mengirim.",409);
  orderPayload(before,"preflight");
  await (dependencies.preflight??checkPublicationReferences)(actor,before);
  // Freeze exact approved version durably before any network mutation. Parallel clicks lose here.
  const reserved=await store.reservePublication(actor,id,version),attempt=reserved.publication!.attemptId;
  let result:{id:number;number:string};
  try {
    result=await (dependencies.create??getOrderCreateTransport())(actor.companyId,reserved.kind as "PO"|"SO"|"SQ",orderPayload(reserved,reserved.publication!.marker));
  } catch(error) {
    const known=error instanceof AccurateCreateError;
    return store.completePublication(actor,id,attempt,{outcome:known&&!error.uncertain?"rejected":"uncertain",error:known?error.message:"Hasil pengiriman belum dapat dipastikan. Periksa dokumen di Accurate; pengiriman ulang dikunci."});
  }
  try { await (dependencies.verify??verifyPublishedOrder)(reserved,result.id,result.number); }
  catch {
    return store.completePublication(actor,id,attempt,{outcome:"uncertain",error:`Accurate mengembalikan nomor ${result.number}, tetapi verifikasi belum berhasil. Gunakan nomor ini untuk memeriksa hasil.`});
  }
  return store.completePublication(actor,id,attempt,{outcome:"published",...result});
}

/** This recovery path can only read Accurate and finish a matching locked reservation. */
export async function reconcileOrder(actor:Actor,id:string,version:number,documentNumber:string) {
  const store=getStore(),draft=await store.get(actor,id);
  assertDraftAccess(actor,draft);
  if(!isHeadForKind(actor,draft.kind)&&!(draft.kind==="SQ"&&actor.role==="sales"&&draft.ownerId===actor.userId))throw new WorkflowError("FORBIDDEN","Pemeriksaan memerlukan kepala bagian terkait.",403);
  if(draft.version!==version||!["PUBLISHING","UNCERTAIN"].includes(draft.status)||!draft.publication)throw new WorkflowError("PUBLICATION_CONFLICT","Muat ulang status dokumen sebelum memeriksa.",409);
  const response=await getReadTransport()<unknown[]>(actor.companyId,`${moduleFor(draft)}/list.do`,{fields:"id,number","filter.number.op":"EQUAL","filter.number.val":documentNumber,"sp.pageSize":2});
  const matches=Array.isArray(response.d)?response.d.map(row).filter(r=>r.number===documentNumber&&Number.isSafeInteger(r.id)):[];
  if(matches.length!==1)throw new WorkflowError("PUBLICATION_NOT_FOUND","Nomor belum ditemukan secara unik pada PT ini. Pengiriman ulang tetap dikunci.",409);
  let result:{id:number;number:string};
  try { result=await verifyPublishedOrder(draft,Number(matches[0].id),documentNumber); }
  catch { throw new WorkflowError("PUBLICATION_MISMATCH","Dokumen tersebut belum terverifikasi sebagai hasil draft ini. Pengiriman ulang tetap dikunci.",409); }
  return store.completePublication(actor,id,draft.publication.attemptId,{outcome:"published",...result});
}
