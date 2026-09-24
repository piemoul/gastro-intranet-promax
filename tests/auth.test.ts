import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, exportJWK, SignJWT, type JWTPayload } from "jose";
import { NextRequest } from "next/server";
import { UserStore, AuthError, MASTER_ADMIN_EMAIL, SESSION_COOKIE, SESSION_AGE, getUsers } from "../src/server/auth/users";
import type { Actor, Role } from "../src/lib/domain";

const userInput = {email:"sales@example.com",name:"Sales One",role:"sales" as const,companyIds:[1,2],active:true};
const identity = (email:string,sub="google-test-sub") => ({email,sub,emailVerified:true,authoritative:true});
function administrator(store:UserStore):Actor {
  const user=store.authenticateIdentity(identity(MASTER_ADMIN_EMAIL,"master-sub"));
  return store.actor(store.createSession(user))!;
}
const denied = (error:unknown) => error instanceof AuthError && error.status >= 400;

test("only whitelisted, active and verified authoritative Google identities are accepted", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store);
    assert.throws(()=>store.authenticateIdentity(identity("unknown@gmail.com")),denied);
    const user=store.save(admin,userInput);
    assert.throws(()=>store.createSession(user),denied);
    for(const invalid of [{...identity(user.email),emailVerified:false},{...identity(user.email),authoritative:false},{...identity(user.email),sub:""},{...identity(user.email),sub:"  "},{...identity(user.email),email:"invalid"}]) {
      assert.throws(()=>store.authenticateIdentity(invalid),denied);
    }
    const authenticated=store.authenticateIdentity(identity("SALES@EXAMPLE.COM"));
    assert.equal(authenticated.id,user.id);
    assert.equal(authenticated.googleSub,"google-test-sub");
    store.save(admin,{name:user.name,role:user.role,companyIds:user.companyIds,active:false},user.id);
    assert.throws(()=>store.authenticateIdentity(identity(user.email)),denied);
  }finally{store.close();}
});

test("master admin is immutable and ordinary roles cannot escalate by request body or forged actor role", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store);
    assert.equal(store.byEmail(MASTER_ADMIN_EMAIL)?.role,"master_admin");
    assert.throws(()=>store.save(admin,{...userInput,email:MASTER_ADMIN_EMAIL}),denied);
    assert.throws(()=>store.save(admin,{name:"Changed Master",role:"sales",companyIds:[1],active:false},admin.userId),denied);
    assert.throws(()=>store.save(admin,{...userInput,role:"master_admin"}));
    for(const extra of [{id:"master-admin"},{teamId:"all"},{googleSub:"forged"},{ownerId:"master-admin"}]) assert.throws(()=>store.save(admin,{...userInput,...extra}));
    const user=store.save(admin,userInput);
    const ordinary=store.actor(store.createSession(store.authenticateIdentity(identity(user.email))))!;
    assert.throws(()=>store.list({...ordinary,role:"master_admin"}),denied);
    assert.throws(()=>store.save({...ordinary,role:"master_admin"},{...userInput,email:"intruder@gmail.com"}),denied);
    assert.equal(store.list(admin).length,2);
  }finally{store.close();}
});

test("master assigns all four ordinary roles and company/team access comes from stored account", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store);
    for(const role of ["sales","head_sales","importer","head_importer"] as Role[]) {
      const user=store.save(admin,{...userInput,email:`${role}@example.com`,role,companyIds:[2,3]});
      const token=store.createSession(store.authenticateIdentity(identity(user.email,`${role}-sub`)));
      const actor=store.actor(token)!;
      assert.equal(actor.role,role);
      assert.equal(actor.teamId,role.includes("sales")?"sales":"importer");
      assert.equal(actor.companyId,2);
      assert.deepEqual(actor.companyIds,[2,3]);
      assert.equal(store.changeCompany(token,3).companyId,3);
      assert.throws(()=>store.changeCompany(token,1),denied);
      assert.equal(store.actor(token)?.companyId,3);
    }
    const normalized=store.save(admin,{...userInput,email:"  Trimmed@Example.com  ",companyIds:[1,1]});
    assert.equal(normalized.email,"trimmed@example.com");
    assert.deepEqual(normalized.companyIds,[1]);
  }finally{store.close();}
});

test("updating or disabling an account revokes every old session and refreshed sessions use current permissions", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store);
    const created=store.save(admin,userInput);
    const authenticated=store.authenticateIdentity(identity(created.email));
    const first=store.createSession(authenticated),second=store.createSession(authenticated);
    const updated=store.save(admin,{name:created.name,role:"importer",companyIds:[3],active:true},created.id);
    assert.equal(store.actor(first),null); assert.equal(store.actor(second),null);
    const token=store.createSession(updated);
    assert.equal(store.actor(token)?.role,"importer"); assert.equal(store.actor(token)?.companyId,3);
    store.save(admin,{name:created.name,role:"importer",companyIds:[3],active:false},created.id);
    assert.equal(store.actor(token),null);
    assert.throws(()=>store.createSession(updated),denied);
  }finally{store.close();}
});

test("Google subject binding is stable and cannot be reassigned to another whitelist identity", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store);
    const first=store.save(admin,userInput);
    const second=store.save(admin,{...userInput,email:"other@example.com"});
    const authenticated=store.authenticateIdentity(identity(first.email,"first-sub"));
    assert.equal(store.authenticateIdentity(identity(first.email,"first-sub")).googleSub,"first-sub");
    assert.throws(()=>store.authenticateIdentity(identity(first.email,"different-sub")),denied);
    assert.throws(()=>store.authenticateIdentity(identity(second.email,"first-sub")),denied);
    assert.equal(store.byId(first.id)?.googleSub,"first-sub");
    assert.equal(store.byId(second.id)?.googleSub,null);
    assert.throws(()=>store.createSession({...authenticated,googleSub:"different-sub"}),denied);
    const bindings=store.db.prepare("SELECT COUNT(*) AS n FROM user_audit WHERE target=? AND action='google_identity_bound'").get(first.id) as {n:number};
    assert.equal(bindings.n,1);
  }finally{store.close();}
});

test("session tokens are hashed, expire at twelve hours and logout revokes access", () => {
  const store=new UserStore(":memory:");
  try {
    const user=store.authenticateIdentity(identity(MASTER_ADMIN_EMAIL,"master-sub"));
    const token=store.createSession(user);
    const row=store.db.prepare("SELECT hash,expires FROM sessions").get() as {hash:string;expires:number};
    assert.notEqual(row.hash,token);
    assert.equal(row.hash,createHash("sha256").update(token).digest("hex"));
    assert.ok(Math.abs(row.expires-Date.now()-SESSION_AGE*1000)<1000);
    assert.equal(store.actor("invalid-token"),null);
    assert.equal(store.actor(undefined),null);
    assert.equal(store.actor("x".repeat(201)),null);
    store.db.prepare("UPDATE sessions SET expires=?").run(Date.now()-1);
    assert.equal(store.actor(token),null);
    const fresh=store.createSession(user); assert.ok(store.actor(fresh));
    store.logout(fresh); assert.equal(store.actor(fresh),null);
  }finally{store.close();}
});

test("OAuth state is hashed and one-time, carries S256 PKCE and expires after ten minutes", () => {
  const store=new UserStore(":memory:");
  try {
    const flow=store.beginOAuth();
    assert.equal(flow.challenge,createHash("sha256").update(flow.verifier).digest("base64url"));
    assert.ok(flow.verifier.length>=43);
    const row=store.db.prepare("SELECT hash,expires FROM oauth_flows").get() as {hash:string;expires:number};
    assert.notEqual(row.hash,flow.state);
    assert.equal(row.hash,createHash("sha256").update(flow.state).digest("hex"));
    assert.ok(Math.abs(row.expires-Date.now()-10*60*1000)<1000);
    assert.deepEqual({...store.consumeOAuth(flow.state)},{nonce:flow.nonce,verifier:flow.verifier});
    assert.throws(()=>store.consumeOAuth(flow.state),denied);
    const expired=store.beginOAuth();
    store.db.prepare("UPDATE oauth_flows SET expires=?").run(Date.now()-1);
    assert.throws(()=>store.consumeOAuth(expired.state),denied);
    assert.throws(()=>store.consumeOAuth("unknown-state"),denied);
  }finally{store.close();}
});

test("account changes and identity binding roll back when the security audit fails", () => {
  const store=new UserStore(":memory:");
  try {
    const admin=administrator(store), user=store.save(admin,userInput);
    store.db.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON user_audit BEGIN SELECT RAISE(ABORT,'Audit failure'); END");
    assert.throws(()=>store.authenticateIdentity(identity(user.email)),/Audit failure/);
    assert.equal(store.byId(user.id)?.googleSub,null);
    assert.throws(()=>store.save(admin,{name:"Changed User",role:"importer",companyIds:[3],active:false},user.id),/Audit failure/);
    assert.deepEqual(store.byId(user.id),user);
    assert.throws(()=>store.db.exec("DELETE FROM user_audit"),/append-only/);
    assert.throws(()=>store.db.exec("UPDATE user_audit SET action='changed'"),/append-only/);
  }finally{store.close();}
});

test("account database refuses WMS paths and symlinks without creating files under WMS", () => {
  assert.throws(()=>new UserStore("/tmp/gastro-wms/users.sqlite"),/WMS/);
  const dir=mkdtempSync(join(tmpdir(),"intranet-auth-path-"));
  try {
    mkdirSync(join(dir,"gastro-wms")); symlinkSync(join(dir,"gastro-wms"),join(dir,"linked"));
    assert.throws(()=>new UserStore(join(dir,"linked","nested","users.sqlite")),/WMS/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("Google token verification and callback enforce signed claims, nonce, state and single use without network calls", async () => {
  const savedFetch=globalThis.fetch;
  const savedEnv={GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET,APP_URL:process.env.APP_URL,INTRANET_DATA_DIR:process.env.INTRANET_DATA_DIR,DATABASE_URL:process.env.DATABASE_URL};
  const dir=mkdtempSync(join(tmpdir(),"intranet-google-test-"));
  process.env.GOOGLE_CLIENT_ID="local-test-client";
  process.env.GOOGLE_CLIENT_SECRET="local-test-secret";
  process.env.APP_URL="http://localhost:3100";
  process.env.INTRANET_DATA_DIR=dir;
  process.env.DATABASE_URL="";
  const {publicKey,privateKey}=await generateKeyPair("RS256");
  const jwk={...await exportJWK(publicKey),kid:"local-key",use:"sig",alg:"RS256"};
  let idToken="";
  let tokenRequests=0;
  let lastTokenBody=new URLSearchParams();
  globalThis.fetch=async(input,init)=>{
    const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
    if(url==="https://www.googleapis.com/oauth2/v3/certs")return Response.json({keys:[jwk]});
    if(url==="https://oauth2.googleapis.com/token"){
      tokenRequests++;
      lastTokenBody=new URLSearchParams(String(init?.body));
      return Response.json({id_token:idToken});
    }
    throw new Error(`Unexpected network request blocked in auth test: ${url}`);
  };
  async function signed(overrides:JWTPayload={}) {
    const now=Math.floor(Date.now()/1000);
    return new SignJWT({iss:"https://accounts.google.com",aud:"local-test-client",sub:"google-master-sub",email:MASTER_ADMIN_EMAIL,email_verified:true,nonce:"expected-nonce",iat:now,exp:now+3600,...overrides}).setProtectedHeader({alg:"RS256",kid:"local-key"}).sign(privateKey);
  }
  let callbackStore:ReturnType<typeof getUsers>|undefined;
  try {
    const google=await import("../src/server/auth/google");
    const authUrl=new URL(google.googleAuthorizeUrl({state:"state",nonce:"nonce",challenge:"challenge"}));
    assert.equal(authUrl.origin,"https://accounts.google.com");
    assert.equal(authUrl.searchParams.get("code_challenge_method"),"S256");
    assert.equal(authUrl.searchParams.get("scope"),"openid email profile");
    assert.equal(authUrl.searchParams.get("redirect_uri"),"http://localhost:3100/api/auth/google/callback");
    idToken=await signed();
    assert.deepEqual(await google.exchangeGoogleCode("local-code",{nonce:"expected-nonce",verifier:"pkce-verifier"}),identity(MASTER_ADMIN_EMAIL,"google-master-sub"));
    assert.equal(lastTokenBody.get("code_verifier"),"pkce-verifier");
    assert.equal(lastTokenBody.get("code"),"local-code");
    for(const claims of [{iss:"https://evil.example"},{aud:"wrong-client"},{nonce:"wrong-nonce"},{azp:"wrong-client"},{email_verified:false},{exp:Math.floor(Date.now()/1000)-10}]) {
      idToken=await signed(claims);
      await assert.rejects(()=>google.exchangeGoogleCode("code",{nonce:"expected-nonce",verifier:"verifier"}));
    }
    idToken=await signed({email:"user@custom.example"});
    assert.equal((await google.exchangeGoogleCode("code",{nonce:"expected-nonce",verifier:"verifier"})).authoritative,false);
    idToken=await signed({email:"user@workspace.example",hd:"workspace.example"});
    assert.equal((await google.exchangeGoogleCode("code",{nonce:"expected-nonce",verifier:"verifier"})).authoritative,true);

    const callback=await import("../src/app/api/auth/google/callback/route");
    const beforeMismatch=tokenRequests;
    const mismatch=await callback.GET(new NextRequest("http://localhost:3100/api/auth/google/callback?code=code&state=state-one",{headers:{cookie:"intranet_oauth=state-two"}}));
    assert.match(mismatch.headers.get("location")||"",/login\?error=login/);
    assert.equal(tokenRequests,beforeMismatch);
    callbackStore=getUsers();
    const flow=await callbackStore.beginOAuth();
    idToken=await signed({nonce:flow.nonce});
    const response=await callback.GET(new NextRequest(`http://localhost:3100/api/auth/google/callback?code=code&state=${flow.state}`,{headers:{cookie:`intranet_oauth=${flow.state}`}}));
    assert.equal(response.headers.get("location"),"http://localhost:3100/");
    const cookie=response.cookies.get(SESSION_COOKIE)!;
    assert.ok(cookie.value);
    assert.equal((await callbackStore.actor(cookie.value))?.role,"master_admin");
    assert.match(response.headers.get("set-cookie")||"",/HttpOnly/i);
    assert.match(response.headers.get("set-cookie")||"",/SameSite=lax/i);
    assert.equal(response.headers.get("cache-control"),"no-store");
    const beforeReplay=tokenRequests;
    const replay=await callback.GET(new NextRequest(`http://localhost:3100/api/auth/google/callback?code=code&state=${flow.state}`,{headers:{cookie:`intranet_oauth=${flow.state}`}}));
    assert.match(replay.headers.get("location")||"",/login\?error=login/);
    assert.equal(tokenRequests,beforeReplay);
  }finally{
    globalThis.fetch=savedFetch;
    await callbackStore?.close();
    for(const [key,value]of Object.entries(savedEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;
    rmSync(dir,{recursive:true,force:true});
  }
});
