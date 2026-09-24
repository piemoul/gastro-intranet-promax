import { PgDraftStore } from "./pg-store";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync, realpathSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, AuditEntry, Draft, DraftAction, DraftKind, DraftPayload, AccurateSource } from "../lib/domain";
import { COMPANIES } from "../lib/domain";
import { draftKindSchema, draftActionSchema, parseDraftPayload, validateCompletePayload, parseAccurateSource, reasonSchema, versionSchema } from "../lib/validation";
import { estimateTransaction } from "../lib/calculations";
import { assertActor, assertCreateKind, assertDraftAccess, assertEdit, assertTransition, canSeeDraft, WorkflowError } from "./workflow";

export { WorkflowError } from "./workflow";
export type CreateDraftInput = {kind:DraftKind; payload:DraftPayload; source?:AccurateSource|null; reason?:string; requestId?:string};
export type UpdateDraftInput = {version:number; payload:DraftPayload; reason?:string};
export type TransitionDraftInput = {version:number; action:DraftAction; reason?:string};
const createSchema = z.object({kind:draftKindSchema,payload:z.unknown(),source:z.unknown().optional(),reason:reasonSchema.optional(),requestId:z.string().trim().min(1).max(128).optional()}).strict();
const updateSchema = z.object({version:versionSchema,payload:z.unknown(),reason:reasonSchema.optional()}).strict();
const transitionSchema = z.object({version:versionSchema,action:draftActionSchema,reason:reasonSchema.optional()}).strict();

function validated<T>(fn:()=>T):T {
  try { return fn(); } catch (error) {
    if (error instanceof z.ZodError) throw new WorkflowError("VALIDATION",error.issues.map(issue => `${issue.path.join(".") || "Draft"}: ${issue.message}`).join("; "),400);
    throw error;
  }
}
function safePayload(kind:DraftKind,input:unknown,complete=false):DraftPayload {
  const payload = validated(() => complete ? validateCompletePayload(kind,input) : parseDraftPayload(kind,input));
  if (payload.type === "transaction") {
    try { estimateTransaction(payload); } catch(error) {
      if (error instanceof RangeError) throw new WorkflowError("VALIDATION",error.message,400);
      throw error;
    }
  }
  return payload;
}
function canonical(value:unknown):string {
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  const object=value as Record<string,unknown>;
  return `{${Object.keys(object).filter(key=>object[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

/** Only Intranet draft state is stored here. This store has no Accurate transport. */
export class DraftStore {
  private readonly db:DatabaseSync;
  constructor(filePath?:string) {
    const target = filePath ?? resolve(process.env.INTRANET_DATA_DIR || resolve(process.cwd(),".data"),"intranet.sqlite");
    if (target !== ":memory:") {
      // This user-selected local database exists at runtime, never as a deployment asset.
      const absolute = resolve(/* turbopackIgnore: true */ target);
      if (absolute.split(sep).includes("gastro-wms")) throw new Error("Intranet tidak boleh menulis ke direktori WMS.");
      let existingParent = dirname(absolute);
      while (!existsSync(/* turbopackIgnore: true */ existingParent)) existingParent = dirname(existingParent);
      const projectedParent = resolve(realpathSync(/* turbopackIgnore: true */ existingParent),relative(existingParent,dirname(absolute)));
      if (projectedParent.split(sep).includes("gastro-wms")) throw new Error("Intranet tidak boleh menulis ke direktori WMS.");
      mkdirSync(dirname(absolute),{recursive:true,mode:0o700});
      const resolved = existsSync(/* turbopackIgnore: true */ absolute) ? realpathSync(/* turbopackIgnore: true */ absolute) : resolve(realpathSync(/* turbopackIgnore: true */ dirname(absolute)),basename(absolute));
      if (resolved.split(sep).includes("gastro-wms")) throw new Error("Intranet tidak boleh memakai database WMS.");
      this.db = new DatabaseSync(absolute);
      chmodSync(absolute,0o600);
    } else this.db = new DatabaseSync(target);
    this.db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY, company_id INTEGER NOT NULL, team_id TEXT NOT NULL, owner_id TEXT NOT NULL,
        kind TEXT NOT NULL, parent_id TEXT REFERENCES drafts(id), document TEXT NOT NULL,
        UNIQUE(parent_id,kind)
      );
      CREATE INDEX IF NOT EXISTS drafts_company_team ON drafts(company_id,team_id);
      CREATE TABLE IF NOT EXISTS sequences (key TEXT PRIMARY KEY,value INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS create_requests (
        actor_id TEXT NOT NULL,company_id INTEGER NOT NULL,request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,
        draft_id TEXT NOT NULL REFERENCES drafts(id),PRIMARY KEY(actor_id,company_id,request_key)
      );
      CREATE TABLE IF NOT EXISTS audit (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,draft_id TEXT NOT NULL REFERENCES drafts(id),
        entry TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_draft ON audit(draft_id,sequence);
      CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit bersifat append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit bersifat append-only'); END;
    `);
  }

  close() { this.db.close(); }
  private transaction<T>(fn:()=>T):T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.db.exec("COMMIT"); return result; }
    catch(error) { this.db.exec("ROLLBACK"); throw error; }
  }
  private read(id:string):Draft {
    const row = this.db.prepare("SELECT document FROM drafts WHERE id = ?").get(id) as {document:string}|undefined;
    if (!row) throw new WorkflowError("NOT_FOUND","Draft tidak ditemukan.",404);
    return JSON.parse(row.document) as Draft;
  }
  private checkVersion(draft:Draft,version:number) {
    if (draft.version !== version) throw new WorkflowError("VERSION_CONFLICT","Draft telah berubah. Muat ulang sebelum menyimpan.",409);
    if (this.db.prepare("SELECT id FROM drafts WHERE parent_id = ? LIMIT 1").get(draft.id)) throw new WorkflowError("DRAFT_HAS_SUCCESSOR","Draft ini sudah memiliki dokumen lanjutan. Buka dokumen lanjutannya untuk perubahan.",409);
  }
  private write(draft:Draft) {
    this.db.prepare("INSERT INTO drafts (id,company_id,team_id,owner_id,kind,parent_id,document) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document").run(draft.id,draft.companyId,draft.teamId,draft.ownerId,draft.kind,draft.parentId,JSON.stringify(draft));
  }
  private appendAudit(actor:Actor,action:string,before:Draft|null,after:Draft,reason:string) {
    const entry:AuditEntry = {id:randomUUID(),draftId:after.id,actorId:actor.userId,actorName:actor.name,action,reason,at:after.updatedAt,before,after};
    this.db.prepare("INSERT INTO audit (id,draft_id,entry) VALUES (?,?,?)").run(entry.id,entry.draftId,JSON.stringify(entry));
  }
  private number(companyId:number,kind:DraftKind) {
    const key = `${companyId}:${kind}`;
    const row = this.db.prepare("INSERT INTO sequences (key,value) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET value=value+1 RETURNING value").get(key) as {value:number};
    return `LOCAL-${COMPANIES.find(company => company.id === companyId)!.code}-${kind.replace("_","-")}-${String(row.value).padStart(5,"0")}`;
  }
  list(actor:Actor):Draft[] {
    assertActor(actor);
    const rows = this.db.prepare("SELECT document FROM drafts WHERE company_id = ? ORDER BY rowid DESC").all(actor.companyId) as {document:string}[];
    return rows.map(row => JSON.parse(row.document) as Draft).filter(draft => canSeeDraft(actor,draft));
  }
  get(actor:Actor,id:string):Draft {
    assertActor(actor);
    const draft = this.read(id);
    assertDraftAccess(actor,draft);
    return draft;
  }
  create(actor:Actor,input:CreateDraftInput):Draft {
    assertActor(actor);
    const parsed = validated(() => createSchema.parse(input));
    const kind = parsed.kind;
    const source = parsed.source == null ? null : validated(() => parseAccurateSource(kind,parsed.source));
    assertCreateKind(actor,kind,source !== null);
    const payload = safePayload(kind,parsed.payload);
    if (!source && payload.type === "transaction" && payload.lines.some(line=>line.sourceLineId!==undefined)) throw new WorkflowError("SOURCE_LINE_MISMATCH","Draft baru tidak boleh mengklaim referensi baris Accurate.",400);
    if (kind === "ITEM_EDIT" && (!source || payload.type !== "item" || source.id !== payload.itemId)) throw new WorkflowError("SOURCE_REQUIRED","Perubahan barang harus menggunakan referensi barang Accurate yang sama.",400);
    if (kind === "CUSTOMER_EDIT" && (!source || payload.type !== "customer" || source.id !== payload.customerId)) throw new WorkflowError("SOURCE_REQUIRED","Perubahan klien harus menggunakan referensi klien Accurate yang sama.",400);
    const fingerprint=createHash("sha256").update(canonical({kind,payload,source,reason:parsed.reason||""})).digest("hex");
    return this.transaction(() => {
      if(parsed.requestId){
        const previous=this.db.prepare("SELECT fingerprint,draft_id FROM create_requests WHERE actor_id=? AND company_id=? AND request_key=?").get(actor.userId,actor.companyId,parsed.requestId) as {fingerprint:string;draft_id:string}|undefined;
        if(previous){
          if(previous.fingerprint!==fingerprint)throw new WorkflowError("IDEMPOTENCY_CONFLICT","Permintaan penyimpanan ini sudah dipakai dengan isi berbeda. Muat ulang draft sebelum mencoba kembali.",409);
          return this.get(actor,previous.draft_id);
        }
      }
      const now = new Date().toISOString();
      const teamId=actor.role==="master_admin"?(kind==="PO"||kind.startsWith("ITEM")?"importer":"sales"):actor.teamId;
      const draft:Draft = {id:randomUUID(),number:this.number(actor.companyId,kind),companyId:actor.companyId,kind,status:"DRAFT",ownerId:actor.userId,ownerName:actor.name,teamId,payload,version:1,createdAt:now,updatedAt:now,source,parentId:null,reason:parsed.reason || "",approvedBy:null};
      this.write(draft);
      this.appendAudit(actor,"create",null,draft,draft.reason);
      if(parsed.requestId)this.db.prepare("INSERT INTO create_requests (actor_id,company_id,request_key,fingerprint,draft_id) VALUES (?,?,?,?,?)").run(actor.userId,actor.companyId,parsed.requestId,fingerprint,draft.id);
      return draft;
    });
  }
  update(actor:Actor,id:string,input:UpdateDraftInput):Draft {
    assertActor(actor);
    const parsed = validated(() => updateSchema.parse(input));
    return this.transaction(() => {
      const before = this.get(actor,id);
      assertEdit(actor,before);
      this.checkVersion(before,parsed.version);
      const payload = safePayload(before.kind,parsed.payload);
      if (payload.type === "transaction" && before.payload.type === "transaction") {
        const originalLines=new Map(before.payload.lines.map(line=>[line.id,line]));
        for(const line of payload.lines) {
          if(line.sourceLineId!==originalLines.get(line.id)?.sourceLineId) throw new WorkflowError("SOURCE_LINE_MISMATCH","Referensi asli baris Accurate tidak boleh diganti atau ditambahkan pada baris baru.",400);
        }
      }
      if (before.kind === "ITEM_EDIT" && payload.type === "item" && payload.itemId !== before.source?.id) throw new WorkflowError("SOURCE_MISMATCH","Referensi barang Accurate tidak boleh diganti.",400);
      if (before.kind === "CUSTOMER_EDIT" && payload.type === "customer" && payload.customerId !== before.source?.id) throw new WorkflowError("SOURCE_MISMATCH","Referensi klien Accurate tidak boleh diganti.",400);
      const draft:Draft = {...before,payload,status:"DRAFT",approvedBy:null,version:before.version+1,updatedAt:new Date().toISOString(),reason:parsed.reason || ""};
      this.write(draft);
      this.appendAudit(actor,"update",before,draft,draft.reason);
      return draft;
    });
  }
  transition(actor:Actor,id:string,input:TransitionDraftInput):Draft {
    assertActor(actor);
    const parsed = validated(() => transitionSchema.parse(input));
    return this.transaction(() => {
      const before = this.get(actor,id);
      this.checkVersion(before,parsed.version);
      const reason = parsed.reason || "";
      assertTransition(actor,before,parsed.action,reason);
      if (["submit","approve","promote"].includes(parsed.action)) safePayload(before.kind,before.payload,true);
      const now = new Date().toISOString();
      if (parsed.action === "promote" || parsed.action === "demote") {
        const kind = parsed.action === "promote" ? "SO" : "SQ";
        const parent:Draft = {...before,updatedAt:now,version:before.version+1,reason};
        this.write(parent);
        this.appendAudit(actor,`${parsed.action}_source`,before,parent,reason);
        const child:Draft = {...before,id:randomUUID(),number:this.number(before.companyId,kind),kind,status:"DRAFT",source:null,parentId:before.id,approvedBy:null,version:1,createdAt:now,updatedAt:now,reason};
        this.write(child);
        this.appendAudit(actor,parsed.action,null,child,reason);
        return child;
      }
      const status = parsed.action === "submit" ? "SUBMITTED" : parsed.action === "approve" ? "APPROVED" : parsed.action === "revise" ? "REVISION" : "DRAFT";
      const draft:Draft = {...before,status,approvedBy:status === "APPROVED" ? actor.userId : null,version:before.version+1,updatedAt:now,reason};
      this.write(draft);
      this.appendAudit(actor,parsed.action,before,draft,reason);
      return draft;
    });
  }
  audit(actor:Actor,id:string):AuditEntry[] {
    this.get(actor,id);
    const rows = this.db.prepare("SELECT entry FROM audit WHERE draft_id = ? ORDER BY sequence DESC").all(id) as {entry:string}[];
    return rows.map(row => JSON.parse(row.entry) as AuditEntry);
  }
  auditAll(actor:Actor):AuditEntry[] {
    assertActor(actor);
    const allowed = new Set(this.list(actor).map(draft => draft.id));
    const rows = this.db.prepare("SELECT audit.entry FROM audit JOIN drafts ON audit.draft_id = drafts.id WHERE drafts.company_id = ? ORDER BY audit.sequence DESC").all(actor.companyId) as {entry:string}[];
    return rows.map(row => JSON.parse(row.entry) as AuditEntry).filter(entry => allowed.has(entry.draftId));
  }
}

let singleton:DraftStore|undefined;
let pgSingleton:PgDraftStore|undefined;
export function getStore():DraftStore|PgDraftStore { if(process.env.DATABASE_URL)return pgSingleton??=new PgDraftStore(); if(process.env.VERCEL)throw new Error("DATABASE_URL required on Vercel"); return singleton ??= new DraftStore(); }
