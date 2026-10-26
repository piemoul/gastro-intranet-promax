import { PgUserStore } from "./pg-users";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, CompanyId, Role } from "@/lib/domain";
import type { DirectoryGrant } from "./portal-policy";

export const MASTER_ADMIN_EMAIL = "malesmikirbos@gmail.com";
export const SESSION_COOKIE = "intranet_session";
export const SESSION_AGE = 12 * 60 * 60;
export type WhitelistedUser = {id:string;email:string;name:string;role:Role;companyIds:CompanyId[];teamId:string;active:boolean;googleSub:string|null};
const regularRoles = z.enum(["sales","head_sales","importer","head_importer"]);
export const userInput = z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(254)),name:z.string().trim().min(2).max(100),role:regularRoles,companyIds:z.array(z.union([z.literal(1),z.literal(2),z.literal(3)])).min(1).max(3).transform(x=>[...new Set(x)]),active:z.boolean().default(true)}).strict();
export const userUpdate = userInput.omit({email:true});
export class AuthError extends Error { constructor(message:string,public status=403) {super(message);} }
type Row = {id:string;email:string;name:string;role:Role;companies:string;team:string;active:number;google_sub:string|null};
const userFromRow=(r:Row):WhitelistedUser=>({id:r.id,email:r.email,name:r.name,role:r.role,companyIds:JSON.parse(r.companies),teamId:r.team,active:!!r.active,googleSub:r.google_sub});
const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");

export class UserStore {
  db:DatabaseSync;
  constructor(filePath=path.join(process.env.INTRANET_DATA_DIR||path.join(process.cwd(),".data"),"users.sqlite")) {
    if(filePath!==":memory:") {
      filePath=path.resolve(filePath);
      if(filePath.split(path.sep).includes("gastro-wms"))throw new Error("Intranet tidak boleh menulis ke direktori WMS.");
      let existingParent=path.dirname(filePath);
      while(!existsSync(existingParent))existingParent=path.dirname(existingParent);
      const projectedParent=path.resolve(realpathSync(existingParent),path.relative(existingParent,path.dirname(filePath)));
      if(projectedParent.split(path.sep).includes("gastro-wms"))throw new Error("Intranet tidak boleh menulis ke direktori WMS.");
      mkdirSync(path.dirname(filePath),{recursive:true,mode:0o700});
      if(existsSync(filePath)&&realpathSync(filePath).split(path.sep).includes("gastro-wms"))throw new Error("Intranet tidak boleh memakai database WMS.");
    }
    this.db=new DatabaseSync(filePath); if(filePath!==":memory:") chmodSync(filePath,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,role TEXT NOT NULL,companies TEXT NOT NULL,team TEXT NOT NULL,active INTEGER NOT NULL,google_sub TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),company_id INTEGER NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth_flows (hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS user_audit (id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,before_json TEXT,after_json TEXT,created_at TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS no_user_audit_update BEFORE UPDATE ON user_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS no_user_audit_delete BEFORE DELETE ON user_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;`);
    this.db.prepare("INSERT OR IGNORE INTO users (id,email,name,role,companies,team,active) VALUES (?,?,?,?,?,?,1)").run("master-admin",MASTER_ADMIN_EMAIL,"Master Admin","master_admin","[1,2,3]","all");
  }
  close(){this.db.close();}
  byEmail(email:string) {const row=this.db.prepare("SELECT * FROM users WHERE email=?").get(email.toLowerCase().trim()) as Row|undefined;return row?userFromRow(row):null;}
  byId(id:string) {const row=this.db.prepare("SELECT * FROM users WHERE id=?").get(id) as Row|undefined;return row?userFromRow(row):null;}
  assertAdmin(actor:Actor){const u=this.byId(actor.userId);if(!u?.active||u.role!=="master_admin")throw new AuthError("Hanya Super Admin yang dapat mengelola pengguna.");}
  syncDirectory(grants:DirectoryGrant[]){
    this.db.exec("BEGIN IMMEDIATE");
    try{
      const previous=(this.db.prepare("SELECT * FROM users WHERE id LIKE 'portal:%'").all() as Row[]).map(userFromRow);
      const desired=new Map(grants.map(g=>[g.id,g]));
      for(const old of previous){
        const g=desired.get(old.id);
        if(!g||g.email!==old.email)desired.set(old.id,{...old,active:false});
      }
      for(const g of desired.values()){
        const old=this.byId(g.id),collision=this.byEmail(g.email);
        if(collision&&collision.id!==g.id)continue; // Never adopt/rebind a manually managed identity.
        const team=g.role==="master_admin"?"all":"sales";
        if(old&&old.name===g.name&&old.role===g.role&&JSON.stringify(old.companyIds)===JSON.stringify(g.companyIds)&&old.active===g.active)continue;
        this.db.prepare("INSERT INTO users (id,email,name,role,companies,team,active) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,companies=excluded.companies,team=excluded.team,active=excluded.active").run(g.id,g.email,g.name,g.role,JSON.stringify(g.companyIds),team,Number(g.active));
        this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(g.id);
        this.db.prepare("INSERT INTO user_audit VALUES (?,?,?,?,?,?,?)").run(randomUUID(),"gastro-portal","directory_sync",g.id,JSON.stringify(old),JSON.stringify(this.byId(g.id)),new Date().toISOString());
      }
      this.db.exec("COMMIT");
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  list(actor:Actor){this.assertAdmin(actor);return(this.db.prepare("SELECT * FROM users ORDER BY role='master_admin' DESC,name").all() as Row[]).map(userFromRow);}
  save(actor:Actor,raw:unknown,id?:string){
    this.assertAdmin(actor);const old=id?this.byId(id):null;
    if(id&&!old)throw new AuthError("Pengguna tidak ditemukan.",404);
    if(old?.email===MASTER_ADMIN_EMAIL)throw new AuthError("Akun master admin tidak dapat diubah atau dinonaktifkan.");
    if(old?.id.startsWith("portal:"))throw new AuthError("Identitas ini dikelola melalui direktori Gastro Portal.");
    const parsed=id?{...userUpdate.parse(raw),email:old!.email}:userInput.parse(raw);
    if(parsed.email===MASTER_ADMIN_EMAIL)throw new AuthError("Email master admin sudah terdaftar.",409);
    if(!id&&this.byEmail(parsed.email))throw new AuthError("Email sudah ada dalam whitelist.",409);
    const userId=id||randomUUID();const team=["sales","head_sales"].includes(parsed.role)?"sales":"importer";
    this.db.exec("BEGIN IMMEDIATE");try{
      if(id)this.db.prepare("UPDATE users SET name=?,role=?,companies=?,team=?,active=? WHERE id=?").run(parsed.name,parsed.role,JSON.stringify(parsed.companyIds),team,Number(parsed.active),id);
      else this.db.prepare("INSERT INTO users (id,email,name,role,companies,team,active) VALUES (?,?,?,?,?,?,?)").run(userId,parsed.email,parsed.name,parsed.role,JSON.stringify(parsed.companyIds),team,Number(parsed.active));
      if(id)this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      const user=this.byId(userId)!;
      this.db.prepare("INSERT INTO user_audit VALUES (?,?,?,?,?,?,?)").run(randomUUID(),actor.userId,id?"user_updated":"user_added",userId,JSON.stringify(old),JSON.stringify(user),new Date().toISOString());
      this.db.exec("COMMIT");return user;
    }catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  authenticateIdentity(identity:{email:string;sub:string;emailVerified:boolean;authoritative:boolean}) {
    if(identity.emailVerified!==true||identity.authoritative!==true||typeof identity.sub!=="string"||!identity.sub.trim()||identity.sub.length>255||typeof identity.email!=="string"||!z.email().safeParse(identity.email.trim()).success)throw new AuthError("Gunakan alamat Gmail atau Google Workspace yang terverifikasi.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const user=this.byEmail(identity.email);
      if(!user?.active)throw new AuthError("Akun Google Anda belum terdaftar atau sudah dinonaktifkan. Hubungi master admin.");
      if(user.googleSub&&user.googleSub!==identity.sub)throw new AuthError("Identitas Google berbeda dari akun yang terdaftar.");
      const bound=this.db.prepare("SELECT id FROM users WHERE google_sub=?").get(identity.sub) as {id:string}|undefined;
      if(bound&&bound.id!==user.id)throw new AuthError("Identitas Google sudah terhubung dengan akun lain.");
      if(!user.googleSub){
        const result=this.db.prepare("UPDATE users SET google_sub=? WHERE id=? AND google_sub IS NULL").run(identity.sub,user.id);
        if(result.changes!==1)throw new AuthError("Identitas Google berubah. Silakan masuk kembali.");
        this.db.prepare("INSERT INTO user_audit VALUES (?,?,?,?,?,?,?)").run(randomUUID(),user.id,"google_identity_bound",user.id,JSON.stringify(user),JSON.stringify(this.byId(user.id)),new Date().toISOString());
      }
      const authenticated=this.byId(user.id)!;
      this.db.exec("COMMIT");return authenticated;
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  createSession(user:WhitelistedUser){
    const current=this.byId(user.id);if(!current?.active)throw new AuthError("Akun tidak aktif.");
    if(!current.googleSub||current.googleSub!==user.googleSub)throw new AuthError("Identitas Google belum terverifikasi. Silakan masuk kembali.",401);
    const token=randomBytes(32).toString("base64url");
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    this.db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(tokenHash(token),user.id,current.companyIds[0],Date.now()+SESSION_AGE*1000);
    return token;
  }
  actor(token:string|undefined):Actor|null{
    if(!token||token.length>200)return null;
    const session=this.db.prepare("SELECT user_id,company_id FROM sessions WHERE hash=? AND expires>?").get(tokenHash(token),Date.now()) as {user_id:string;company_id:CompanyId}|undefined;
    const u=session?this.byId(session.user_id):null;if(!u?.active||!session||!u.companyIds.includes(session.company_id))return null;
    return {userId:u.id,name:u.name,role:u.role,companyId:session.company_id,companyIds:u.companyIds,teamId:u.teamId};
  }
  changeCompany(token:string,companyId:CompanyId){const actor=this.actor(token);if(!actor?.companyIds.includes(companyId))throw new AuthError("Anda tidak memiliki akses PT ini.");this.db.prepare("UPDATE sessions SET company_id=? WHERE hash=?").run(companyId,tokenHash(token));return this.actor(token)!;}
  logout(token:string){this.db.prepare("DELETE FROM sessions WHERE hash=?").run(tokenHash(token));}
  beginOAuth(){const state=randomBytes(32).toString("base64url"),nonce=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");this.db.prepare("DELETE FROM oauth_flows WHERE expires<?").run(Date.now());this.db.prepare("INSERT INTO oauth_flows VALUES (?,?,?,?)").run(tokenHash(state),nonce,verifier,Date.now()+10*60*1000);return {state,nonce,verifier,challenge:tokenHashBase64(verifier)};}
  consumeOAuth(state:string){const row=this.db.prepare("DELETE FROM oauth_flows WHERE hash=? AND expires>? RETURNING nonce,verifier").get(tokenHash(state),Date.now()) as {nonce:string;verifier:string}|undefined;if(!row)throw new AuthError("Sesi login kedaluwarsa. Silakan masuk lagi.",400);return row;}
}
function tokenHashBase64(token:string){return createHash("sha256").update(token).digest("base64url");}
let singleton:UserStore|undefined;
let pgSingleton:PgUserStore|undefined;
export function getUsers(){if(process.env.DATABASE_URL)return pgSingleton??=new PgUserStore();if(process.env.VERCEL)throw new Error("DATABASE_URL required on Vercel");return singleton??=new UserStore();}
