import { emptyTransaction, type Actor, type DraftKind, type DraftPayload } from "@/lib/domain";
import { WorkflowError } from "./workflow";

/** Defense in depth in both durable stores, not only the HTTP/UI boundary. */
export function assertSQEntryFields(actor:Actor,kind:DraftKind,payload:DraftPayload,previous?:DraftPayload){
  if(kind!=="SQ"||actor.role!=="sales"||payload.type!=="transaction")return;
  const old=previous?.type==="transaction"?previous:emptyTransaction();
  if(JSON.stringify(payload.quoteOptions)!==JSON.stringify(old.quoteOptions))throw new WorkflowError("SQ_PRICING_ROLE","Ketentuan komersial hanya dapat diubah reviewer.",403);
  const keys=["currency","exchangeRate","branch","paymentTerm","shipDate","address","reference","salesperson","discountPercent","inclusiveTax","customFields"] as const;
  if(keys.some(k=>JSON.stringify(payload[k])!==JSON.stringify(old[k])))throw new WorkflowError("SQ_PRICING_ROLE","Harga dan ketentuan komersial diisi admin sales atau Super Admin.",403);
  const detailKeys=["validity","delivery","installation","warranty","franco","payment"] as const;
  if(payload.sqDetails?.pricingReviewed===true&&old.sqDetails?.pricingReviewed!==true)throw new WorkflowError("SQ_PRICING_ROLE","Review harga memerlukan admin sales atau Super Admin.",403);
  if(detailKeys.some(k=>JSON.stringify(payload.sqDetails?.[k]??"")!==JSON.stringify(old.sqDetails?.[k]??"")))throw new WorkflowError("SQ_PRICING_ROLE","Review harga memerlukan admin sales atau Super Admin.",403);
  for(const line of payload.lines){
    const prior=old.lines.find(l=>l.id===line.id);
    if(JSON.stringify(line.pricing)!==JSON.stringify(prior?.pricing))throw new WorkflowError("SQ_PRICING_ROLE","Penerapan pricebook hanya dapat dilakukan reviewer.",403);
    if(line.unitPrice!==(prior?.unitPrice??0)||line.discountPercent!==(prior?.discountPercent??0)||line.taxPercent!==(prior?.taxPercent??0)||(line.taxBasePercent??100)!==(prior?.taxBasePercent??100)||line.warehouse!==(prior?.warehouse??"")||JSON.stringify(line.customFields??{})!==JSON.stringify(prior?.customFields??{})||(line.project||"")!==(prior?.project||"")||(line.department||"")!==(prior?.department||""))throw new WorkflowError("SQ_PRICING_ROLE","Sales hanya dapat mengisi pilihan barang dan jumlah; harga diisi admin.",403);
    // Existing prices cannot be moved to another product.
    if(prior&&(prior.itemId!==line.itemId||prior.itemNo!==line.itemNo||prior.unit!==line.unit))throw new WorkflowError("SQ_PRICING_ROLE","Ganti barang dengan menghapus baris dan menambah pilihan baru.",403);
  }
}
