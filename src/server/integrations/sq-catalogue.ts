import "server-only";
import type { Actor, DraftPayload } from "@/lib/domain";
import { findItemByNo, getItem } from "../accurate";
import { wmsCatalog } from "./reference-api";
import { WorkflowError } from "../workflow";

export async function resolveWmsItem(actor:Actor,code:string,wmsId:string){
  const result=await wmsCatalog(actor.companyId,{code});
  const matches=result.items.filter(p=>p.code===code&&p.id===wmsId);
  if(matches.length!==1)throw new WorkflowError("WMS_ITEM_CHANGED","SKU tidak ditemukan pada WMS PT aktif. Pilih ulang barang.",409);
  const source=matches[0],summary=await findItemByNo(actor.companyId,code);
  if(!summary)throw new WorkflowError("WMS_ACCURATE_MAPPING","SKU WMS belum cocok dengan master Accurate PT aktif. Hubungi admin untuk pemetaan.",409);
  const item=await getItem(actor.companyId,summary.id);
  if(!item.active)throw new WorkflowError("WMS_ACCURATE_MAPPING","SKU Accurate sudah tidak aktif.",409);
  return {item,source,fetchedAt:result.fetchedAt};
}
export async function validateSQCatalogue(actor:Actor,payload:DraftPayload){
  if(payload.type!=="transaction")return;
  for(const line of payload.lines){
    if(line.entrySource?.kind==="custom")continue;
    if(!line.entrySource?.wmsId){
      if(actor.role==="sales")throw new WorkflowError("WMS_SOURCE_REQUIRED","Pilih barang dari katalog WMS atau gunakan entry custom.",400);
      continue; // Legacy admin draft or manual Accurate mapping.
    }
    const {item}=await resolveWmsItem(actor,line.itemNo,line.entrySource.wmsId);
    if(item.id!==line.itemId)throw new WorkflowError("WMS_ACCURATE_MAPPING","ID barang tidak sesuai pemetaan WMS dan Accurate.",409);
  }
}
