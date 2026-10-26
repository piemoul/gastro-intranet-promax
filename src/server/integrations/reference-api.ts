import "server-only";
import { z } from "zod";
import type { CompanyId } from "@/lib/domain";

export async function referenceGet(service: "PORTAL" | "WMS", params: Record<string,string>) {
  const base = process.env[`INTRANET_${service}_API_URL`];
  const key = process.env[`INTRANET_${service}_API_KEY`];
  if (!base || !key) throw new Error(`API ${service} belum dikonfigurasi.`);
  const url = new URL(base);
  if (url.username || url.password || !["https:","http:"].includes(url.protocol)
    || (url.protocol === "http:" && !["host.docker.internal","wms-read-api","localhost","127.0.0.1"].includes(url.hostname))) throw new Error("Alamat integrasi tidak diizinkan.");
  for (const [name,value] of Object.entries(params)) url.searchParams.set(name,value);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Unavailable");
    return await response.json() as unknown;
  } catch { throw new Error(`API ${service} belum tersedia. Coba muat ulang.`); }
}
export const wmsItemSchema = z.object({ id:z.string(), code:z.string(),name:z.string(),brand:z.string(),model:z.string(),unit:z.string(),classification:z.string(),available:z.number().nonnegative(),stock:z.array(z.object({warehouseId:z.number(),warehouse:z.string(),accurateWarehouse:z.string().nullable(),onHand:z.number().nonnegative(),booked:z.number().nonnegative(),available:z.number().nonnegative()})) });
export const wmsCatalogSchema = z.object({companyId:z.number(),brands:z.array(z.string()),models:z.array(z.string()),items:z.array(wmsItemSchema),hasMore:z.boolean(),page:z.number(),fetchedAt:z.iso.datetime()});
export type WmsItem = z.infer<typeof wmsItemSchema>;
let exclusions:{expires:number;keys:Set<string>}|undefined;
const identity=(brand:string,model:string)=>`${brand.trim().toLowerCase()}\0${model.trim().toLowerCase()}`;
export async function excludedCatalogueItems(){
  if(!process.env.INTRANET_PORTAL_API_URL)return new Set<string>();
  if(exclusions&&Date.now()<exclusions.expires)return exclusions.keys;
  const data=z.object({items:z.array(z.object({brand:z.string(),model:z.string(),custom:z.boolean(),archived:z.boolean()}))}).parse(await referenceGet("PORTAL",{resource:"catalogue-index"}));
  const keys=new Set(data.items.filter(p=>p.custom||p.archived).map(p=>identity(p.brand,p.model)));
  exclusions={expires:Date.now()+60000,keys};return keys;
}
export async function wmsCatalog(companyId:CompanyId, params:Record<string,string>) {
  const data = wmsCatalogSchema.parse(await referenceGet("WMS",{...params,companyId:String(companyId)}));
  if (data.companyId!==companyId) throw new Error("PT sumber WMS tidak cocok.");
  const excluded=await excludedCatalogueItems();
  data.items=data.items.filter(item=>!excluded.has(identity(item.brand,item.model)));
  return data;
}
