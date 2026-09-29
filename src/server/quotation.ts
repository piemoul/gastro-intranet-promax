import "server-only";
import type { Actor, Draft } from "../lib/domain";
import { getDocument } from "./accurate";
import { verifyPublishedOrder } from "./publish-order";
import { quotationReference, WorkflowError } from "./workflow";

export async function validateQuotationSelection(actor:Actor,draft:Draft) {
  const ref=quotationReference(draft);
  if(!ref)throw new WorkflowError("SQ_NOT_PUBLISHED","SQ harus tersimpan di Accurate sebelum dipilih untuk SO.",409);
  const doc=await getDocument(actor.companyId,"SQ",ref.id);
  if(doc.id!==ref.id||doc.number!==ref.number||doc.dependencies.some(d=>d.kind==="SO"))throw new WorkflowError("QUOTATION_CHANGED","SQ berubah atau sudah memiliki SO di Accurate. Periksa dokumen terbaru.",409);
  if(draft.publication?.accurateId)await verifyPublishedOrder(draft,ref.id,ref.number);
}

export async function validateOrderQuotation(actor:Actor,draft:Draft) {
  if(draft.kind!=="SO")return;
  const ref=draft.quotation,p=draft.payload;
  if(!ref||p.type!=="transaction")throw new WorkflowError("SO_REQUIRES_QUOTATION","SO harus dibuat dari SQ Accurate yang dipilih.",409);
  const doc=await getDocument(actor.companyId,"SQ",ref.id);
  if(doc.id!==ref.id||doc.number!==ref.number||doc.header.partnerId!==p.partnerId||doc.header.partnerNo!==p.partnerNo||doc.currency!==p.currency||doc.dependencies.some(d=>d.kind==="SO"))throw new WorkflowError("QUOTATION_CHANGED","SQ berubah, berbeda pelanggan/mata uang, atau sudah memiliki SO di Accurate.",409);
  for(const line of p.lines) {
    const matches=doc.lines.filter(l=>l.itemId===line.itemId&&l.itemNo===line.itemNo&&l.unit===line.unit);
    const requested=p.lines.filter(l=>l.itemId===line.itemId&&l.unit===line.unit).reduce((sum,l)=>sum+l.quantity,0);
    const available=matches.reduce((sum,l)=>sum+(l.availableQuantity??l.quantity),0);
    if(!matches.length||requested>available)throw new WorkflowError("QUOTATION_LINES","Barang, satuan atau jumlah SO tidak sesuai sisa SQ Accurate yang dipilih.",409);
  }
}
