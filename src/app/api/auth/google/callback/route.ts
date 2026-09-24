import { NextRequest,NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getUsers,SESSION_COOKIE,SESSION_AGE } from "@/server/auth/users";
import { appUrl,exchangeGoogleCode } from "@/server/auth/google";
export async function GET(request:NextRequest){
  let response:NextResponse;
  try {
    const state=request.nextUrl.searchParams.get("state")||"",cookie=request.cookies.get("intranet_oauth")?.value||"";
    if(!state||state.length!==cookie.length||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))throw new Error("InvalidState");
    const flow=await getUsers().consumeOAuth(state),code=request.nextUrl.searchParams.get("code");if(!code)throw new Error("MissingCode");
    const identity=await exchangeGoogleCode(code,flow);const user=await getUsers().authenticateIdentity(identity);
    const old=request.cookies.get(SESSION_COOKIE)?.value;if(old)await getUsers().logout(old);
    const token=await getUsers().createSession(user);response=NextResponse.redirect(new URL("/",appUrl()));
    response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,secure:appUrl().startsWith("https:"),sameSite:"lax",path:"/",maxAge:SESSION_AGE});
  }catch(error){const denied=error instanceof Error&&/belum terdaftar|dinonaktifkan/.test(error.message);response=NextResponse.redirect(new URL(`/login?error=${denied?"whitelist":"login"}`,appUrl()));}
  response.cookies.delete("intranet_oauth");response.headers.set("Cache-Control","no-store");return response;
}
