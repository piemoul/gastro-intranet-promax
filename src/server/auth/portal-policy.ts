import { z } from "zod";
import type { CompanyId, Role } from "@/lib/domain";

// Exact canonical Baserow identities verified against Gastro Portal; never name/Portal ROLE based.
export const PORTAL_SUPER_ADMINS: Record<string,string> = {
  "5":"dondy.i@gastro.co.id", "30":"a.rendy@saranarefrigeratama.co.id", "38":"yogi.k@gastro.co.id",
};
export const directorySchema = z.object({source:z.literal("gastro-portal-baserow"),complete:z.literal(true),fetchedAt:z.iso.datetime(),items:z.array(z.object({id:z.string().regex(/^\d+$/),name:z.string().trim().min(1).max(100),email:z.email().max(254),company:z.string(),department:z.string(),active:z.boolean()})).max(10000)});
export type DirectoryGrant = {id:string;email:string;name:string;role:Role;companyIds:CompanyId[];active:boolean};
export function directoryGrants(raw:unknown):DirectoryGrant[] {
  const snapshot=directorySchema.parse(raw);
  if(Math.abs(Date.now()-Date.parse(snapshot.fetchedAt))>120000)throw new Error("Snapshot Portal kedaluwarsa.");
  if(new Set(snapshot.items.map(p=>p.id)).size!==snapshot.items.length || new Set(snapshot.items.map(p=>p.email.toLowerCase())).size!==snapshot.items.length)throw new Error("Identitas Portal ganda.");
  return snapshot.items.flatMap(p=>{
    const email=p.email.toLowerCase(),superAdmin=PORTAL_SUPER_ADMINS[p.id]===email;
    const company=p.company.toUpperCase().replace(/[^A-Z0-9]/g,"");
    const companyIds:CompanyId[]=superAdmin?[1,2,3]:company==="GGS"||company.startsWith("PTGASTROGIZISARANA")?[1]:["SR","SRI","PTSARANAREFRIGERATAMA"].includes(company)?[3]:["RSP","PTRESTOSARANAPRIMA"].includes(company)?[2]:[];
    const sales=p.department.trim().replace(/\s+/g," ").toUpperCase()==="SALES & MARKETING";
    if((!superAdmin&&!sales)||!companyIds.length)return [];
    return [{id:`portal:${p.id}`,email,name:p.name,role:superAdmin?"master_admin":"sales",companyIds,active:p.active&&companyIds.length>0}];
  });
}
