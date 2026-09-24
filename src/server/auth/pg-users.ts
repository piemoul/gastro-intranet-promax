import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import type { Actor, CompanyId, Role } from "@/lib/domain";
import { ensureSchema, getSql } from "../postgres";
import { AuthError, MASTER_ADMIN_EMAIL, SESSION_AGE, userInput, userUpdate, type WhitelistedUser } from "./users";

type Row={id:string;email:string;name:string;role:Role;companies:CompanyId[];team:string;active:boolean;google_sub:string|null};
type Identity={email:string;sub:string;emailVerified:boolean;authoritative:boolean};
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const fromRow=(row:Row):WhitelistedUser=>({id:row.id,email:row.email,name:row.name,role:row.role,companyIds:row.companies,teamId:row.team,active:row.active,googleSub:row.google_sub});
const actorFromRow=(row:Row,companyId:CompanyId):Actor=>({userId:row.id,name:row.name,role:row.role,companyId,companyIds:row.companies,teamId:row.team});
const isUniqueViolation=(error:unknown)=>error!==null&&typeof error==="object"&&"code" in error&&error.code==="23505";

/** Durable production authentication. Every table and function is owned by Intranet. */
export class PgUserStore {
  constructor(private readonly sql:Sql=getSql()){}
  async ready():Promise<void>{
    await ensureSchema("auth-v1",async tx=>{
      await tx`CREATE TABLE IF NOT EXISTS intranet_users (
        id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE CHECK (email=lower(btrim(email))),name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('sales','head_sales','importer','head_importer','master_admin')),
        companies JSONB NOT NULL CHECK (jsonb_typeof(companies)='array' AND jsonb_array_length(companies) BETWEEN 1 AND 3 AND companies <@ '[1,2,3]'::jsonb),
        team TEXT NOT NULL,active BOOLEAN NOT NULL,google_sub TEXT UNIQUE CHECK (google_sub IS NULL OR length(btrim(google_sub)) BETWEEN 1 AND 255),
        CONSTRAINT intranet_master_admin_invariant CHECK (
          (email='malesmikirbos@gmail.com' AND id='master-admin' AND role='master_admin' AND active AND companies='[1,2,3]'::jsonb AND team='all') OR
          (email<>'malesmikirbos@gmail.com' AND id<>'master-admin' AND role<>'master_admin')
        )
      )`;
      await tx`CREATE TABLE IF NOT EXISTS intranet_sessions (
        hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES intranet_users(id),company_id INTEGER NOT NULL CHECK (company_id IN (1,2,3)),expires BIGINT NOT NULL
      )`;
      await tx`CREATE INDEX IF NOT EXISTS intranet_sessions_user_idx ON intranet_sessions(user_id)`;
      await tx`CREATE INDEX IF NOT EXISTS intranet_sessions_expiry_idx ON intranet_sessions(expires)`;
      await tx`CREATE TABLE IF NOT EXISTS intranet_oauth_flows (hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires BIGINT NOT NULL)`;
      await tx`CREATE INDEX IF NOT EXISTS intranet_oauth_expiry_idx ON intranet_oauth_flows(expires)`;
      await tx`CREATE TABLE IF NOT EXISTS intranet_user_audit (
        id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,before_json JSONB,after_json JSONB,created_at TIMESTAMPTZ NOT NULL
      )`;
      await tx`CREATE INDEX IF NOT EXISTS intranet_user_audit_target_idx ON intranet_user_audit(target,created_at)`;
      await tx`CREATE OR REPLACE FUNCTION intranet_reject_user_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Intranet audit is append-only'; END;
      $$`;
      await tx`DROP TRIGGER IF EXISTS intranet_user_audit_append_only ON intranet_user_audit`;
      await tx`CREATE TRIGGER intranet_user_audit_append_only BEFORE UPDATE OR DELETE ON intranet_user_audit FOR EACH ROW EXECUTE FUNCTION intranet_reject_user_audit_change()`;
      await tx`CREATE OR REPLACE FUNCTION intranet_protect_user_identity() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF TG_OP='DELETE' THEN
            IF OLD.email='malesmikirbos@gmail.com' THEN RAISE EXCEPTION 'Intranet master admin is immutable'; END IF;
            RETURN OLD;
          END IF;
          IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN RAISE EXCEPTION 'Intranet account identity is immutable'; END IF;
          IF OLD.google_sub IS NOT NULL AND NEW.google_sub IS DISTINCT FROM OLD.google_sub THEN RAISE EXCEPTION 'Intranet Google identity is immutable'; END IF;
          IF OLD.email='malesmikirbos@gmail.com' AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.role IS DISTINCT FROM OLD.role OR NEW.companies IS DISTINCT FROM OLD.companies OR NEW.team IS DISTINCT FROM OLD.team OR NEW.active IS DISTINCT FROM OLD.active) THEN
            RAISE EXCEPTION 'Intranet master admin is immutable';
          END IF;
          RETURN NEW;
        END;
      $$`;
      await tx`DROP TRIGGER IF EXISTS intranet_user_identity_immutable ON intranet_users`;
      await tx`CREATE TRIGGER intranet_user_identity_immutable BEFORE UPDATE OR DELETE ON intranet_users FOR EACH ROW EXECUTE FUNCTION intranet_protect_user_identity()`;
      await tx`INSERT INTO intranet_users (id,email,name,role,companies,team,active) VALUES ('master-admin',${MASTER_ADMIN_EMAIL},'Master Admin','master_admin','[1,2,3]'::jsonb,'all',TRUE) ON CONFLICT DO NOTHING`;
    },this.sql);
    await ensureSchema("auth-v2-audit-truncate",async tx=>{
      await tx`CREATE TRIGGER intranet_user_audit_no_truncate BEFORE TRUNCATE ON intranet_user_audit FOR EACH STATEMENT EXECUTE FUNCTION intranet_reject_user_audit_change()`;
      await tx`CREATE FUNCTION intranet_reject_user_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Intranet master admin is immutable'; END;
      $$`;
      await tx`CREATE TRIGGER intranet_users_no_truncate BEFORE TRUNCATE ON intranet_users FOR EACH STATEMENT EXECUTE FUNCTION intranet_reject_user_truncate()`;
    },this.sql);
  }
  async close(){await this.sql.end({timeout:5});}
  async byEmail(email:string):Promise<WhitelistedUser|null>{
    await this.ready();
    const rows=await this.sql<Row[]>`SELECT * FROM intranet_users WHERE email=${email.toLowerCase().trim()}`;
    return rows[0]?fromRow(rows[0]):null;
  }
  async byId(id:string):Promise<WhitelistedUser|null>{
    await this.ready();
    const rows=await this.sql<Row[]>`SELECT * FROM intranet_users WHERE id=${id}`;
    return rows[0]?fromRow(rows[0]):null;
  }
  async assertAdmin(actor:Actor):Promise<void>{
    const user=await this.byId(actor.userId);
    if(!user?.active||user.role!=="master_admin"||user.email!==MASTER_ADMIN_EMAIL)throw new AuthError("Hanya master admin yang dapat mengelola pengguna.");
  }
  async list(actor:Actor):Promise<WhitelistedUser[]>{
    await this.assertAdmin(actor);
    return (await this.sql<Row[]>`SELECT * FROM intranet_users ORDER BY (role='master_admin') DESC,name`).map(fromRow);
  }
  private async audit(tx:TransactionSql,actor:string,action:string,target:string,before:WhitelistedUser|null,after:WhitelistedUser){
    await tx`INSERT INTO intranet_user_audit (id,actor,action,target,before_json,after_json,created_at) VALUES (${randomUUID()},${actor},${action},${target},${tx.json(before)},${tx.json(after)},${new Date().toISOString()})`;
  }
  async save(actor:Actor,raw:unknown,id?:string):Promise<WhitelistedUser>{
    await this.assertAdmin(actor);
    try {
      return await this.sql.begin(async tx=>{
        const previous=id?(await tx<Row[]>`SELECT * FROM intranet_users WHERE id=${id} FOR UPDATE`)[0]:undefined;
        const old=previous?fromRow(previous):null;
        if(id&&!old)throw new AuthError("Pengguna tidak ditemukan.",404);
        if(old?.email===MASTER_ADMIN_EMAIL)throw new AuthError("Akun master admin tidak dapat diubah atau dinonaktifkan.");
        const parsed=id?{...userUpdate.parse(raw),email:old!.email}:userInput.parse(raw);
        if(parsed.email===MASTER_ADMIN_EMAIL)throw new AuthError("Email master admin sudah terdaftar.",409);
        const userId=id||randomUUID(),team=["sales","head_sales"].includes(parsed.role)?"sales":"importer";
        const rows=id?
          await tx<Row[]>`UPDATE intranet_users SET name=${parsed.name},role=${parsed.role},companies=${tx.json(parsed.companyIds)},team=${team},active=${parsed.active} WHERE id=${id} RETURNING *`:
          await tx<Row[]>`INSERT INTO intranet_users (id,email,name,role,companies,team,active) VALUES (${userId},${parsed.email},${parsed.name},${parsed.role},${tx.json(parsed.companyIds)},${team},${parsed.active}) RETURNING *`;
        if(id)await tx`DELETE FROM intranet_sessions WHERE user_id=${id}`;
        const user=fromRow(rows[0]);
        await this.audit(tx,actor.userId,id?"user_updated":"user_added",userId,old,user);
        return user;
      });
    }catch(error){if(isUniqueViolation(error))throw new AuthError("Email sudah ada dalam whitelist.",409);throw error;}
  }
  async authenticateIdentity(identity:Identity):Promise<WhitelistedUser>{
    if(identity.emailVerified!==true||identity.authoritative!==true||typeof identity.sub!=="string"||!identity.sub.trim()||identity.sub.length>255||typeof identity.email!=="string"||!z.email().safeParse(identity.email.trim()).success)throw new AuthError("Gunakan alamat Gmail atau Google Workspace yang terverifikasi.");
    await this.ready();
    try {
      return await this.sql.begin(async tx=>{
        const rows=await tx<Row[]>`SELECT * FROM intranet_users WHERE email=${identity.email.toLowerCase().trim()} FOR UPDATE`;
        const user=rows[0]?fromRow(rows[0]):null;
        if(!user?.active)throw new AuthError("Akun Google Anda belum terdaftar atau sudah dinonaktifkan. Hubungi master admin.");
        if(user.googleSub&&user.googleSub!==identity.sub)throw new AuthError("Identitas Google berbeda dari akun yang terdaftar.");
        if(user.googleSub)return user;
        const updated=await tx<Row[]>`UPDATE intranet_users SET google_sub=${identity.sub} WHERE id=${user.id} AND google_sub IS NULL RETURNING *`;
        if(!updated[0])throw new AuthError("Identitas Google berubah. Silakan masuk kembali.");
        const authenticated=fromRow(updated[0]);
        await this.audit(tx,user.id,"google_identity_bound",user.id,user,authenticated);
        return authenticated;
      });
    }catch(error){if(isUniqueViolation(error))throw new AuthError("Identitas Google sudah terhubung dengan akun lain.");throw error;}
  }
  async createSession(user:WhitelistedUser):Promise<string>{
    await this.ready();
    return await this.sql.begin(async tx=>{
      const rows=await tx<Row[]>`SELECT * FROM intranet_users WHERE id=${user.id} FOR UPDATE`;
      const current=rows[0]?fromRow(rows[0]):null;
      if(!current?.active)throw new AuthError("Akun tidak aktif.");
      if(!current.googleSub||current.googleSub!==user.googleSub)throw new AuthError("Identitas Google belum terverifikasi. Silakan masuk kembali.",401);
      const token=randomBytes(32).toString("base64url"),now=Date.now();
      await tx`DELETE FROM intranet_sessions WHERE expires<${now}`;
      await tx`INSERT INTO intranet_sessions (hash,user_id,company_id,expires) VALUES (${hash(token)},${current.id},${current.companyIds[0]},${now+SESSION_AGE*1000})`;
      return token;
    });
  }
  async actor(token:string|undefined):Promise<Actor|null>{
    if(!token||token.length>200)return null;
    await this.ready();
    const rows=await this.sql<(Row&{company_id:CompanyId})[]>`SELECT u.*,s.company_id FROM intranet_sessions s JOIN intranet_users u ON u.id=s.user_id WHERE s.hash=${hash(token)} AND s.expires>${Date.now()} AND u.active AND u.companies @> to_jsonb(ARRAY[s.company_id])`;
    return rows[0]?actorFromRow(rows[0],rows[0].company_id):null;
  }
  async changeCompany(token:string,companyId:CompanyId):Promise<Actor>{
    await this.ready();
    if(![1,2,3].includes(companyId))throw new AuthError("Anda tidak memiliki akses PT ini.");
    const rows=await this.sql`UPDATE intranet_sessions s SET company_id=${companyId} FROM intranet_users u WHERE s.hash=${hash(token)} AND s.expires>${Date.now()} AND s.user_id=u.id AND u.active AND u.companies @> ${this.sql.json([companyId])}::jsonb RETURNING s.user_id`;
    if(!rows.length)throw new AuthError("Anda tidak memiliki akses PT ini.");
    const actor=await this.actor(token);
    if(!actor)throw new AuthError("Sesi login tidak berlaku. Silakan masuk kembali.",401);
    return actor;
  }
  async logout(token:string):Promise<void>{await this.ready();await this.sql`DELETE FROM intranet_sessions WHERE hash=${hash(token)}`;}
  async beginOAuth():Promise<{state:string;nonce:string;verifier:string;challenge:string}>{
    await this.ready();
    const state=randomBytes(32).toString("base64url"),nonce=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url"),now=Date.now();
    await this.sql`DELETE FROM intranet_oauth_flows WHERE expires<${now}`;
    await this.sql`INSERT INTO intranet_oauth_flows (hash,nonce,verifier,expires) VALUES (${hash(state)},${nonce},${verifier},${now+10*60*1000})`;
    return {state,nonce,verifier,challenge:createHash("sha256").update(verifier).digest("base64url")};
  }
  async consumeOAuth(state:string):Promise<{nonce:string;verifier:string}>{
    await this.ready();
    if(!state||state.length>200)throw new AuthError("Sesi login kedaluwarsa. Silakan masuk lagi.",400);
    const rows=await this.sql<{nonce:string;verifier:string}[]>`DELETE FROM intranet_oauth_flows WHERE hash=${hash(state)} AND expires>${Date.now()} RETURNING nonce,verifier`;
    if(!rows[0])throw new AuthError("Sesi login kedaluwarsa. Silakan masuk lagi.",400);
    return {nonce:rows[0].nonce,verifier:rows[0].verifier};
  }
}
