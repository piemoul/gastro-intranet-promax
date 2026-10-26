import "server-only";
import { cookies } from "next/headers";
import { getUsers, SESSION_COOKIE, AuthError } from "./users";
import { refreshPortalDirectory } from "./portal";
export async function getActor(){
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  const current=await getUsers().actor(token);
  if(current?.role==="sales"&&process.env.INTRANET_PORTAL_API_URL&&!current.userId.startsWith("portal:"))throw new AuthError("Akun sales harus terdaftar melalui Gastro Portal.");
  if(current?.userId.startsWith("portal:")){
    try{await refreshPortalDirectory();}catch{throw new AuthError("Direktori Portal belum dapat diverifikasi. Coba lagi.",503);}
  }
  return getUsers().actor(token);
}
export async function requireActor(){const actor=await getActor();if(!actor)throw new AuthError("Silakan masuk dengan akun Google yang terdaftar.",401);return actor;}
