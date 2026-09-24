import { NextResponse } from "next/server";
import { getUsers } from "@/server/auth/users";
import { appUrl, googleAuthorizeUrl, googleConfigured } from "@/server/auth/google";
export async function GET(){
  if(!googleConfigured())return NextResponse.redirect(new URL("/login?error=configuration",appUrl()));
  const flow=await getUsers().beginOAuth();const response=NextResponse.redirect(googleAuthorizeUrl(flow));
  response.cookies.set("intranet_oauth",flow.state,{httpOnly:true,secure:appUrl().startsWith("https:"),sameSite:"lax",path:"/",maxAge:600});
  response.headers.set("Cache-Control","no-store");return response;
}
