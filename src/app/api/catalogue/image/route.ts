import { requireActor } from "@/server/auth/session";
import { referenceGet } from "@/server/integrations/reference-api";
import { z } from "zod";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const actor=await requireActor();if(!["sales","head_sales","master_admin"].includes(actor.role))return new Response(null,{status:403});
    const url=new URL(request.url),brand=(url.searchParams.get("brand")||"").slice(0,150),model=(url.searchParams.get("model")||"").slice(0,150);
    const data=z.object({items:z.array(z.object({image:z.string().nullable()}))}).parse(await referenceGet("PORTAL",{resource:"catalogue",brand,model}));
    if(data.items.length!==1||!data.items[0].image?.startsWith("/")||data.items[0].image.startsWith("//"))return new Response(null,{status:404});
    const base=new URL(process.env.INTRANET_PORTAL_API_URL!),image=new URL(data.items[0].image,base.origin);
    if(image.origin!==base.origin)return new Response(null,{status:404});
    const result=await fetch(image,{redirect:"error",signal:AbortSignal.timeout(8000),cache:"no-store"});
    const type=result.headers.get("content-type")||"";
    if(!result.ok||!/^image\/(png|jpeg|webp|avif)$/.test(type)||Number(result.headers.get("content-length"))>5000000)return new Response(null,{status:404});
    const bytes=await result.arrayBuffer();if(bytes.byteLength>5000000)return new Response(null,{status:404});
    return new Response(bytes,{headers:{"Content-Type":type,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});
  }catch{return new Response(null,{status:503});}
}
