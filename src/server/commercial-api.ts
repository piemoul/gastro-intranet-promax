import "server-only";
import { z } from "zod";
import type { Actor } from "@/lib/domain";
import { emptyManagedItem,settingsSchema } from "@/lib/commercial";
import { getCommercialStore } from "./commercial-store";
import { assertSuper,assertReviewer,commercialSettings,saveManagedItem,saveSkuMapping,referenceOptions,applyPricebook,pricingAnalysis,duplicateQuote,saveFollowup } from "./commercial-service";
import { getItem } from "./accurate";
import { getReadTransport } from "./accurate/environment";
import { list,row,text,number } from "./accurate/normalize";
import { getStore } from "./store";
import { json } from "./http";
import { WorkflowError } from "./workflow";
const id=z.coerce.number().int().positive(),version=z.number().int().min(0),recordInput=z.object({version,data:z.unknown()}).strict();
const csv=(v:unknown)=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
export async function commercialGet(actor:Actor,path:string[],url:URL):Promise<Response>{
  const route=path.slice(1).join("/"),store=getCommercialStore();
  if(route==="settings"){const {record,settings}=await commercialSettings(actor);return json({record,settings});}
  if(route==="lookups")return json(await referenceOptions(actor));
  if(route==="items"){assertReviewer(actor);const search=(url.searchParams.get("search")||"").toLowerCase();return json({items:(await store.list(actor,"ITEM")).filter(r=>JSON.stringify(r.data).toLowerCase().includes(search))});}
  if(path[1]==="items"&&path.length===3){assertReviewer(actor);const item=await getItem(actor.companyId,id.parse(path[2])),record=await store.get(actor,"ITEM",String(item.id));return json({item,record,parameters:record?.data??{...emptyManagedItem(),accurateId:item.id,accurateNo:item.no,name:item.name,brand:item.brand,model:item.model,unit:item.unit}});}
  if(route==="mappings")return json({items:await store.list(actor,"SKU_MAP")});
  if(route==="audit")return json({items:await store.audit(actor)});
  if(path[1]==="analysis"&&path.length===3)return json(await pricingAnalysis(actor,await getStore().get(actor,path[2])));
  if(route==="reports"||route==="reports.csv"){
    const items=await getStore().list(actor),followups=await store.list(actor,"FOLLOWUP"),search=(url.searchParams.get("search")||"").toLowerCase(),from=url.searchParams.get("from")||"",to=url.searchParams.get("to")||"";
    const rows=items.filter(d=>d.kind==="SQ"&&d.payload.type==="transaction"&&(!from||d.payload.date>=from)&&(!to||d.payload.date<=to)&&JSON.stringify([d.number,d.ownerName,d.payload.partnerName]).toLowerCase().includes(search)).map(d=>({id:d.id,number:d.publication?.accurateNumber||d.number,date:d.payload.type==="transaction"?d.payload.date:"",customer:d.payload.type==="transaction"?d.payload.partnerName:"",owner:d.ownerName,status:d.status,followup:followups.find(f=>f.key===d.id)?.data??null,followupVersion:followups.find(f=>f.key===d.id)?.version??0,currency:d.payload.type==="transaction"?d.payload.currency:"IDR",payload:d.payload,version:d.version}));
    if(route.endsWith(".csv")){const {estimateTransaction}=await import("@/lib/calculations");return new Response("\uFEFF"+[["Nomor","Tanggal","Klien","Sales","Status","Mata uang","Total"],...rows.map(r=>[r.number,r.date,r.customer,r.owner,r.status,r.currency,r.payload.type==="transaction"?estimateTransaction(r.payload).total:0])].map(r=>r.map(csv).join(",")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=quotation-report.csv","Cache-Control":"no-store"}});}
    return json({items:rows});
  }
  if(route==="vendors"){
    const page=z.coerce.number().int().min(1).max(10000).parse(url.searchParams.get("page")||1),search=(url.searchParams.get("search")||"").slice(0,150);
    const r=await getReadTransport()(actor.companyId,"vendor/list.do",{fields:"id,vendorNo,name,email,workPhone,suspended","sp.page":page,"sp.pageSize":30,"filter.keywords.op":"CONTAIN","filter.keywords.val":search});
    return json({items:list(r.d).map(v=>{const x=row(v);return{id:number(x.id),no:text(x.vendorNo),name:text(x.name),email:text(x.email),phone:text(x.workPhone),active:x.suspended!==true};}),page,pageCount:Number(r.sp?.pageCount||1),total:Number(r.sp?.rowCount||0)});
  }
  throw new WorkflowError("NOT_FOUND","Fungsi komersial tidak ditemukan.",404);
}
export async function commercialWrite(actor:Actor,path:string[],input:unknown):Promise<Response>{
  if(path[1]==="settings"&&path.length===2){assertSuper(actor);const p=recordInput.parse(input);return json({record:await getCommercialStore().save(actor,"SETTINGS","default",p.version,settingsSchema.parse(p.data))});}
  if(path[1]==="items"&&path.length===3){const p=recordInput.parse(input);return json({record:await saveManagedItem(actor,id.parse(path[2]),p.version,p.data)});}
  if(path[1]==="mappings"&&path.length===3){const p=recordInput.parse(input);if(!p.data||typeof p.data!=="object"||!("wmsId"in p.data)||p.data.wmsId!==path[2])throw new WorkflowError("INVALID_MAPPING","Identitas pemetaan tidak cocok.");return json({record:await saveSkuMapping(actor,p.version,p.data)});}
  if(path[1]==="drafts"&&path[3]==="apply-pricebook"&&path.length===4){const p=z.object({version:z.number().int().positive(),choices:z.array(z.object({lineId:z.string().min(1),tier:z.number().int().min(0).max(5)}).strict()).min(1).max(500)}).strict().parse(input);return json({draft:await applyPricebook(actor,path[2],p.version,p.choices)});}
  if(path[1]==="drafts"&&path[3]==="duplicate"&&path.length===4){const p=z.object({version:z.number().int().positive(),requestId:z.string().min(1).max(100)}).strict().parse(input);return json({draft:await duplicateQuote(actor,path[2],p.version,p.requestId)},201);}
  if(path[1]==="followup"&&path.length===3){const p=recordInput.parse(input);return json({record:await saveFollowup(actor,path[2],p.version,p.data)});}
  throw new WorkflowError("NOT_FOUND","Tindakan komersial tidak ditemukan.",404);
}
