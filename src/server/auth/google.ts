import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthError } from "./users";
const JWKS=createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export function googleConfigured(){return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;}
export function appUrl(){const url=new URL(process.env.APP_URL||"http://localhost:3100");if(!["https:","http:"].includes(url.protocol)||(url.protocol!=="https:"&&!["localhost","127.0.0.1"].includes(url.hostname)))throw new AuthError("APP_URL harus menggunakan HTTPS.",503);return url.origin;}
export function googleConfig(){if(!googleConfigured())throw new AuthError("Google Sign-In belum dikonfigurasi.",503);return{clientId:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!,redirectUri:appUrl()+"/api/auth/google/callback"};}
export function googleAuthorizeUrl(flow:{state:string;nonce:string;challenge:string}){const config=googleConfig();const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:"code",scope:"openid email profile",state:flow.state,nonce:flow.nonce,code_challenge:flow.challenge,code_challenge_method:"S256",prompt:"select_account"}).toString();return url.toString();}
export async function exchangeGoogleCode(code:string,flow:{nonce:string;verifier:string}){
  const config=googleConfig();const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,grant_type:"authorization_code",code_verifier:flow.verifier}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new AuthError("Google belum dapat memverifikasi login. Silakan coba lagi.",401);
  const result=await response.json();if(typeof result.id_token!=="string")throw new AuthError("Identitas Google tidak tersedia.",401);
  const {payload}=await jwtVerify(result.id_token,JWKS,{issuer:["https://accounts.google.com","accounts.google.com"],audience:config.clientId,algorithms:["RS256"],requiredClaims:["sub","email","email_verified","exp","iat","nonce"]});
  if(payload.nonce!==flow.nonce||typeof payload.sub!=="string"||typeof payload.email!=="string"||payload.email_verified!==true||(payload.azp&&payload.azp!==config.clientId))throw new AuthError("Identitas Google tidak valid.",401);
  return {sub:payload.sub,email:payload.email.toLowerCase(),emailVerified:true,authoritative:payload.email.toLowerCase().endsWith("@gmail.com")||(typeof payload.hd==="string"&&payload.hd.length>0)};
}
