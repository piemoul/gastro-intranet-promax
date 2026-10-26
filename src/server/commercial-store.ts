import { DatabaseSync } from "node:sqlite";
import { mkdirSync,existsSync,realpathSync,chmodSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Sql,TransactionSql } from "postgres";
import type { Actor } from "@/lib/domain";
import { commercialData,type CommercialKind } from "@/lib/commercial";
import { assertActor,WorkflowError } from "./workflow";
import { getSql,ensureSchema } from "./postgres";

export type CommercialRecord={companyId:number;kind:CommercialKind;key:string;data:ReturnType<typeof commercialData>;version:number;updatedAt:string;updatedBy:string};
export type CommercialAudit={id:string;companyId:number;kind:CommercialKind;key:string;actorId:string;actorName:string;at:string;before:CommercialRecord|null;after:CommercialRecord};
const canReview=(actor:Actor)=>["master_admin","head_sales","head_importer"].includes(actor.role);
function access(actor:Actor,kind:CommercialKind,record?:CommercialRecord,write=false){
  assertActor(actor);if(record&&record.companyId!==actor.companyId)throw new WorkflowError("FORBIDDEN","Data berbeda PT.",403);
  if(write&&kind!=="FOLLOWUP"&&actor.role!=="master_admin")throw new WorkflowError("FORBIDDEN","Pengaturan dan parameter barang hanya dapat diubah Super Admin.",403);
  if(kind==="ITEM"&&!canReview(actor))throw new WorkflowError("FORBIDDEN","Pricebook dan biaya hanya dapat dibaca reviewer.",403);
  if(kind==="FOLLOWUP"&&record){const d=record.data as {ownerId:string;teamId:string};if(actor.role!=="master_admin"&&!(canReview(actor)&&actor.teamId===d.teamId)&&actor.userId!==d.ownerId)throw new WorkflowError("FORBIDDEN","Tindak lanjut bukan milik tim/pengguna ini.",403);}
}
function nextRecord(actor:Actor,kind:CommercialKind,key:string,version:number,data:unknown,before:CommercialRecord|null){
  access(actor,kind,before??undefined,true);if(!Number.isSafeInteger(version)||version<0||(before?.version??0)!==version)throw new WorkflowError("VERSION_CONFLICT","Parameter sudah berubah. Muat ulang sebelum menyimpan.",409);
  const parsed=commercialData(kind,data);const after:CommercialRecord={companyId:actor.companyId,kind,key,data:parsed,version:version+1,updatedAt:new Date().toISOString(),updatedBy:actor.userId};
  access(actor,kind,after,true);
  if(kind==="FOLLOWUP"&&before){const a=parsed as {ownerId:string;teamId:string},b=before.data as typeof a;if(a.ownerId!==b.ownerId||a.teamId!==b.teamId)throw new WorkflowError("FORBIDDEN","Pemilik tindak lanjut tidak dapat diganti.",403);}
  return after;
}
export class CommercialStore{
  db:DatabaseSync;
  constructor(file=path.join(process.env.INTRANET_DATA_DIR||path.join(process.cwd(),".data"),"commercial.sqlite")){
    if(file!==":memory:"){file=path.resolve(file);let parent=path.dirname(file);while(!existsSync(parent))parent=path.dirname(parent);const projected=existsSync(file)?realpathSync(file):path.resolve(realpathSync(parent),path.relative(parent,file));if(/(^|[\\/])gastro-wms[^\\/]*([\\/]|$)/i.test(projected))throw new Error("Database parameter Intranet harus terpisah dari WMS.");mkdirSync(path.dirname(file),{recursive:true,mode:0o700});}
    this.db=new DatabaseSync(file);if(file!==":memory:")chmodSync(file,0o600);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS intranet_commercial_records(company_id INTEGER NOT NULL,kind TEXT NOT NULL,key TEXT NOT NULL,document TEXT NOT NULL,PRIMARY KEY(company_id,kind,key));
      CREATE TABLE IF NOT EXISTS intranet_commercial_audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,company_id INTEGER NOT NULL,kind TEXT NOT NULL,key TEXT NOT NULL,document TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS intranet_commercial_no_update BEFORE UPDATE ON intranet_commercial_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS intranet_commercial_no_delete BEFORE DELETE ON intranet_commercial_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;`);
  }
  close(){this.db.close();}
  get(actor:Actor,kind:CommercialKind,key:string):CommercialRecord|null{access(actor,kind);const row=this.db.prepare("SELECT document FROM intranet_commercial_records WHERE company_id=? AND kind=? AND key=?").get(actor.companyId,kind,key) as {document:string}|undefined;const record=row?JSON.parse(row.document) as CommercialRecord:null;access(actor,kind,record??undefined);return record;}
  list(actor:Actor,kind:CommercialKind){access(actor,kind);return (this.db.prepare("SELECT document FROM intranet_commercial_records WHERE company_id=? AND kind=? ORDER BY key").all(actor.companyId,kind) as {document:string}[]).map(r=>JSON.parse(r.document) as CommercialRecord).filter(r=>{try{access(actor,kind,r);return true;}catch{return false;}});}
  save(actor:Actor,kind:CommercialKind,key:string,version:number,data:unknown){
    this.db.exec("BEGIN IMMEDIATE");try{const before=this.get(actor,kind,key),after=nextRecord(actor,kind,key,version,data,before);const entry:CommercialAudit={id:randomUUID(),companyId:actor.companyId,kind,key,actorId:actor.userId,actorName:actor.name,at:after.updatedAt,before,after};
      this.db.prepare("INSERT INTO intranet_commercial_records VALUES (?,?,?,?) ON CONFLICT(company_id,kind,key) DO UPDATE SET document=excluded.document").run(actor.companyId,kind,key,JSON.stringify(after));this.db.prepare("INSERT INTO intranet_commercial_audit(id,company_id,kind,key,document) VALUES (?,?,?,?,?)").run(entry.id,actor.companyId,kind,key,JSON.stringify(entry));this.db.exec("COMMIT");return after;
    }catch(e){this.db.exec("ROLLBACK");throw e;}
  }
  audit(actor:Actor,kind?:CommercialKind,key?:string){assertActor(actor);if(!canReview(actor))throw new WorkflowError("FORBIDDEN","Audit parameter hanya untuk reviewer.",403);return (this.db.prepare("SELECT document FROM intranet_commercial_audit WHERE company_id=? ORDER BY sequence DESC LIMIT 1000").all(actor.companyId) as {document:string}[]).map(r=>JSON.parse(r.document) as CommercialAudit).filter(r=>(!kind||r.kind===kind)&&(!key||r.key===key));}
  atVersion(actor:Actor,key:string,version:number){access(actor,"ITEM");const r=this.db.prepare("SELECT document FROM intranet_commercial_audit WHERE company_id=? AND kind='ITEM' AND key=? AND json_extract(document,'$.after.version')=? LIMIT 1").get(actor.companyId,key,version) as {document:string}|undefined;return r?(JSON.parse(r.document) as CommercialAudit).after:null;}
}
export class PgCommercialStore{
  constructor(private sql:Sql=getSql()){}
  async ready(){await ensureSchema("commercial-v1",async tx=>{
    await tx`CREATE TABLE IF NOT EXISTS intranet_commercial_records(company_id INTEGER NOT NULL CHECK(company_id IN(1,2,3)),kind TEXT NOT NULL,key TEXT NOT NULL,document JSONB NOT NULL,PRIMARY KEY(company_id,kind,key))`;
    await tx`CREATE TABLE IF NOT EXISTS intranet_commercial_audit(sequence BIGSERIAL PRIMARY KEY,id TEXT UNIQUE NOT NULL,company_id INTEGER NOT NULL,kind TEXT NOT NULL,key TEXT NOT NULL,document JSONB NOT NULL)`;
    await tx`CREATE OR REPLACE FUNCTION intranet_reject_commercial_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit is append-only'; END; $$`;
    await tx`CREATE TRIGGER intranet_commercial_append_only BEFORE UPDATE OR DELETE ON intranet_commercial_audit FOR EACH ROW EXECUTE FUNCTION intranet_reject_commercial_audit()`;
    await tx`CREATE TRIGGER intranet_commercial_no_truncate BEFORE TRUNCATE ON intranet_commercial_audit FOR EACH STATEMENT EXECUTE FUNCTION intranet_reject_commercial_audit()`;
  },this.sql);}
  async close(){await this.sql.end({timeout:5});}
  async get(actor:Actor,kind:CommercialKind,key:string){access(actor,kind);await this.ready();const rows=await this.sql<{document:CommercialRecord}[]>`SELECT document FROM intranet_commercial_records WHERE company_id=${actor.companyId} AND kind=${kind} AND key=${key}`;const r=rows[0]?.document??null;access(actor,kind,r??undefined);return r;}
  async list(actor:Actor,kind:CommercialKind){access(actor,kind);await this.ready();return (await this.sql<{document:CommercialRecord}[]>`SELECT document FROM intranet_commercial_records WHERE company_id=${actor.companyId} AND kind=${kind} ORDER BY key`).map(r=>r.document).filter(r=>{try{access(actor,kind,r);return true;}catch{return false;}});}
  async save(actor:Actor,kind:CommercialKind,key:string,version:number,data:unknown){access(actor,kind,undefined,true);await this.ready();return this.sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`intranet-commercial:${actor.companyId}:${kind}:${key}`}))`;
    const rows=await (tx as TransactionSql)<{document:CommercialRecord}[]>`SELECT document FROM intranet_commercial_records WHERE company_id=${actor.companyId} AND kind=${kind} AND key=${key} FOR UPDATE`;
    const before=rows[0]?.document??null,after=nextRecord(actor,kind,key,version,data,before);const entry:CommercialAudit={id:randomUUID(),companyId:actor.companyId,kind,key,actorId:actor.userId,actorName:actor.name,at:after.updatedAt,before,after};
    await tx`INSERT INTO intranet_commercial_records VALUES (${actor.companyId},${kind},${key},${tx.json(after)}) ON CONFLICT(company_id,kind,key) DO UPDATE SET document=excluded.document`;
    await tx`INSERT INTO intranet_commercial_audit(id,company_id,kind,key,document) VALUES (${entry.id},${actor.companyId},${kind},${key},${tx.json(entry)})`;return after;
  });}
  async audit(actor:Actor,kind?:CommercialKind,key?:string){assertActor(actor);if(!canReview(actor))throw new WorkflowError("FORBIDDEN","Audit parameter hanya untuk reviewer.",403);await this.ready();return (await this.sql<{document:CommercialAudit}[]>`SELECT document FROM intranet_commercial_audit WHERE company_id=${actor.companyId} ORDER BY sequence DESC LIMIT 1000`).map(r=>r.document).filter(r=>(!kind||r.kind===kind)&&(!key||r.key===key));}
  async atVersion(actor:Actor,key:string,version:number){access(actor,"ITEM");await this.ready();const rows=await this.sql<{document:CommercialAudit}[]>`SELECT document FROM intranet_commercial_audit WHERE company_id=${actor.companyId} AND kind='ITEM' AND key=${key} AND document->'after'->>'version'=${String(version)} LIMIT 1`;return rows[0]?.document.after??null;}
}
let local:CommercialStore|undefined,pg:PgCommercialStore|undefined;
export function getCommercialStore(){if(process.env.DATABASE_URL)return pg??=new PgCommercialStore();if(process.env.VERCEL)throw new Error("DATABASE_URL required");return local??=new CommercialStore();}
