import { cookies } from "next/headers";
import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { getUsers,SESSION_COOKIE,AuthError,MASTER_ADMIN_EMAIL,type WhitelistedUser } from "@/server/auth/users";
import { body,handle,json } from "@/server/http";
import { getStore } from "@/server/store";
import { assertCreateKind,assertEdit,assertTransition } from "@/server/workflow";
import { draftKindSchema,parseDraftPayload,draftActionSchema,versionSchema,reasonSchema } from "@/lib/validation";
import { COMPANIES,type Actor } from "@/lib/domain";
import { listDocuments,getDocument,searchItems,getItem,searchPartners,getConnectionStatus,searchCustomers,getCustomer } from "@/server/accurate";
import { fromAccurate,validateAccurateReferences,validateSourceUnchanged } from "@/server/draft-sources";
export const dynamic="force-dynamic";
export const runtime="nodejs";
type Context={params:Promise<{path:string[]}>};
const documentKind=z.enum(["PO","SQ","SO"]);
function publicUser(u:WhitelistedUser){return {id:u.id,email:u.email,name:u.name,role:u.role,companyIds:u.companyIds,teamId:u.teamId,active:u.active};}
const idSchema=z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
function assertHead(actor:Actor,kind:"PO"|"SQ"|"SO"|"ITEM"|"CUSTOMER"){if(actor.role==="master_admin")return;if(kind==="ITEM"?actor.role!=="head_importer":kind==="PO"?actor.role!=="head_importer":actor.role!=="head_sales")throw new AuthError("Akses ini hanya untuk kepala bagian terkait.");}
export async function GET(request:Request,context:Context){return handle(async()=>{
  const actor=await requireActor(),{path}=await context.params,route=path.join("/"),url=new URL(request.url);const search=(url.searchParams.get("search")||"").slice(0,150);const page=z.coerce.number().int().min(1).max(10000).parse(url.searchParams.get("page")||1);
  if(route==="session")return json({actor,companies:COMPANIES.filter(c=>actor.companyIds.includes(c.id)),connections:getConnectionStatus().filter(c=>actor.companyIds.includes(c.companyId as 1|2|3))});
  if(route==="users")return json({items:(await getUsers().list(actor)).map(publicUser),masterAdminEmail:MASTER_ADMIN_EMAIL});
  if(route==="drafts"){const kind=url.searchParams.get("kind");if(kind)draftKindSchema.parse(kind);return json({items:(await getStore().list(actor)).filter(d=>!kind||d.kind===kind)});}
  if(path[0]==="drafts"&&path.length===2)return json({draft:await getStore().get(actor,path[1]),audit:await getStore().audit(actor,path[1])});
  if(route==="audit")return json({items:await getStore().auditAll(actor)});
  if(route==="accurate/documents"){const kind=documentKind.parse(url.searchParams.get("kind"));assertHead(actor,kind);return json(await listDocuments(actor.companyId,kind,{search,page}));}
  if(path[0]==="accurate"&&path[1]==="documents"&&path.length===4){const kind=documentKind.parse(path[2]);assertHead(actor,kind);return json({document:await getDocument(actor.companyId,kind,idSchema.parse(path[3]))});}
  if(route==="accurate/items")return json(await searchItems(actor.companyId,search,page));
  if(path[0]==="accurate"&&path[1]==="items"&&path.length===3)return json({item:await getItem(actor.companyId,idSchema.parse(path[2]))});
  if(route==="accurate/partners"){const kind=z.enum(["customer","vendor"]).parse(url.searchParams.get("kind"));if(actor.role!=="master_admin"&&((kind==="customer")!==["sales","head_sales"].includes(actor.role)))throw new AuthError("Akses mitra tidak sesuai peran.");return json({items:search.trim().length<2?[]:await searchPartners(actor.companyId,kind,search)});}
  if(route==="accurate/customers"){assertHead(actor,"CUSTOMER");return json(await searchCustomers(actor.companyId,search,page));}
  if(path[0]==="accurate"&&path[1]==="customers"&&path.length===3){assertHead(actor,"CUSTOMER");return json({customer:await getCustomer(actor.companyId,idSchema.parse(path[2]))});}
  throw new AuthError("Halaman tidak ditemukan.",404);
});}
export async function POST(request:Request,context:Context){return handle(async()=>{
  const input=await body(request),actor=await requireActor(),{path}=await context.params,route=path.join("/");
  if(route==="auth/logout"){const jar=await cookies(),token=jar.get(SESSION_COOKIE)?.value;if(token)await getUsers().logout(token);jar.delete(SESSION_COOKIE);return json({ok:true});}
  if(route==="session/company"){const {companyId}=z.object({companyId:z.union([z.literal(1),z.literal(2),z.literal(3)])}).strict().parse(input);return json({actor:await getUsers().changeCompany((await cookies()).get(SESSION_COOKIE)!.value,companyId)});}
  if(route==="users"){const user=publicUser(await getUsers().save(actor,input));return json({user},201);}
  if(route==="drafts/from-accurate"){const {kind,id,requestId}=z.object({kind:z.enum(["PO","SQ","SO","ITEM","CUSTOMER"]),id:idSchema,requestId:z.string().max(100).optional()}).strict().parse(input);assertHead(actor,kind);const data=await fromAccurate(actor,kind,id);return json({draft:await getStore().create(actor,{...data,requestId})},201);}
  if(route==="drafts"){
    const {kind,payload:raw,requestId}=z.object({kind:draftKindSchema,payload:z.unknown(),requestId:z.string().max(100).optional()}).strict().parse(input);assertCreateKind(actor,kind,false);if(["ITEM_EDIT","CUSTOMER_EDIT"].includes(kind))throw new AuthError("Buka master Accurate untuk membuat usulan perubahan.",400);
    const payload=parseDraftPayload(kind,raw);await validateAccurateReferences(actor,kind,payload);return json({draft:await getStore().create(actor,{kind,payload,requestId})},201);
  }
  if(path[0]==="drafts"&&path[2]==="action"&&path.length===3){const data=z.object({version:versionSchema,action:draftActionSchema,reason:reasonSchema.optional()}).strict().parse(input),draft=await getStore().get(actor,path[1]);assertTransition(actor,draft,data.action,data.reason||"");if(["submit","approve","promote"].includes(data.action)){await validateAccurateReferences(actor,draft.kind,draft.payload);await validateSourceUnchanged(actor,draft);}return json({draft:await getStore().transition(actor,path[1],data)});}
  throw new AuthError("Tindakan tidak tersedia. Accurate hanya dapat dibaca.",405);
});}
export async function PUT(request:Request,context:Context){return handle(async()=>{
  const input=await body(request),actor=await requireActor(),{path}=await context.params;
  if(path[0]==="users"&&path.length===2){const user=publicUser(await getUsers().save(actor,input,path[1]));return json({user});}
  if(path[0]==="drafts"&&path.length===2){const data=z.object({version:versionSchema,payload:z.unknown()}).strict().parse(input),draft=await getStore().get(actor,path[1]);assertEdit(actor,draft);const payload=parseDraftPayload(draft.kind,data.payload);await validateAccurateReferences(actor,draft.kind,payload);await validateSourceUnchanged(actor,draft);return json({draft:await getStore().update(actor,path[1],{version:data.version,payload})});}
  throw new AuthError("Tindakan tidak tersedia. Accurate hanya dapat dibaca.",405);
});}
