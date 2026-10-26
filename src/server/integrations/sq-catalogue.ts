import "server-only";
import type { Actor, DraftPayload } from "@/lib/domain";
import { findItemByNo, getItem } from "../accurate";
import { wmsCatalog } from "./reference-api";
import { WorkflowError } from "../workflow";
import { getCommercialStore } from "../commercial-store";
import { mappingSchema } from "@/lib/commercial";

export async function resolveWmsItem(actor:Actor,code:string,wmsId:string){
  const result=await wmsCatalog(actor.companyId,{code});
  const matches=result.items.filter(p=>p.code===code&&p.id===wmsId);
  if(matches.length!==1)throw new WorkflowError("WMS_ITEM_CHANGED","SKU tidak ditemukan pada WMS PT aktif. Pilih ulang barang.",409);
  const source=matches[0],record=await getCommercialStore().get(actor,"SKU_MAP",wmsId);
  const mapping=record?mappingSchema.parse(record.data):null;
  if(mapping?.active&&mapping.wmsCode!==code)throw new WorkflowError("WMS_ITEM_CHANGED","Kode WMS berubah; tinjau pemetaan Manage Items.",409);
  const summary=mapping?.active?{id:mapping.accurateId}:await findItemByNo(actor.companyId,code);
  if(!summary)throw new WorkflowError("WMS_ACCURATE_MAPPING","SKU WMS belum cocok dengan master Accurate PT aktif. Hubungi admin untuk pemetaan.",409);
  const item=await getItem(actor.companyId,summary.id);
  if(mapping?.active&&item.no!==mapping.accurateNo)throw new WorkflowError("WMS_ACCURATE_MAPPING","Kode Accurate pada pemetaan berubah. Tinjau ulang pemetaan.",409);
  if(!item.active)throw new WorkflowError("WMS_ACCURATE_MAPPING","SKU Accurate sudah tidak aktif.",409);
  return {item,source,fetchedAt:result.fetchedAt,mappingVersion:record?.version??null};
}
export async function validateSQCatalogue(actor:Actor,payload:DraftPayload){
  if(payload.type!=="transaction")return;
  for(const line of payload.lines){
    if(line.entrySource?.kind==="custom")continue;
    if(line.entrySource?.kind==="accurate")continue; // Canonical ID/no/unit checked by Accurate reference validation.
    if(!line.entrySource?.wmsId){
      if(actor.role==="sales")throw new WorkflowError("WMS_SOURCE_REQUIRED","Pilih barang dari katalog WMS atau gunakan entry custom.",400);
      continue; // Legacy admin draft or manual Accurate mapping.
    }
    const {item}=await resolveWmsItem(actor,line.entrySource.wmsCode||line.itemNo,line.entrySource.wmsId);
    if(item.id!==line.itemId)throw new WorkflowError("WMS_ACCURATE_MAPPING","ID barang tidak sesuai pemetaan WMS dan Accurate.",409);
  }
}
