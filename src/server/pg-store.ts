import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { JSONValue } from "postgres";
import type { Actor, AuditEntry, Draft, DraftKind, DraftPayload } from "../lib/domain";
import { COMPANIES } from "../lib/domain";
import { draftKindSchema, draftActionSchema, parseDraftPayload, validateCompletePayload, parseAccurateSource, reasonSchema, versionSchema } from "../lib/validation";
import { estimateTransaction } from "../lib/calculations";
import { assertActor, assertCreateKind, assertDraftAccess, assertEdit, assertTransition, canSeeDraft, WorkflowError } from "./workflow";
import type { CreateDraftInput, UpdateDraftInput, TransitionDraftInput } from "./store";
import { closeSql, ensureSchema, getSql, type Sql, type TransactionSql } from "./postgres";

type Executor = Sql | TransactionSql;
type DraftRow = { document: Draft };
const createSchema = z.object({ kind: draftKindSchema, payload: z.unknown(), source: z.unknown().optional(), reason: reasonSchema.optional(), requestId: z.string().trim().min(1).max(128).optional() }).strict();
const updateSchema = z.object({ version: versionSchema, payload: z.unknown(), reason: reasonSchema.optional() }).strict();
const transitionSchema = z.object({ version: versionSchema, action: draftActionSchema, reason: reasonSchema.optional() }).strict();

function validated<T>(fn: () => T): T {
  try { return fn(); } catch (error) {
    if (error instanceof z.ZodError) throw new WorkflowError("VALIDATION", error.issues.map(issue => `${issue.path.join(".") || "Draft"}: ${issue.message}`).join("; "), 400);
    throw error;
  }
}
function safePayload(kind: DraftKind, input: unknown, complete = false): DraftPayload {
  const payload = validated(() => complete ? validateCompletePayload(kind, input) : parseDraftPayload(kind, input));
  if (payload.type === "transaction") {
    try { estimateTransaction(payload); } catch (error) {
      if (error instanceof RangeError) throw new WorkflowError("VALIDATION", error.message, 400);
      throw error;
    }
  }
  return payload;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

/** Durable cloud storage for local Intranet drafts. No Accurate integration is imported. */
export class PgDraftStore {
  private readonly sql: Sql;
  private readonly shared: boolean;
  constructor(sql?: Sql) {
    this.sql = sql ?? getSql();
    this.shared = !sql;
  }

  ready(): Promise<void> {
    return ensureSchema("drafts-v1", async transaction => {
      await transaction`CREATE TABLE IF NOT EXISTS intranet_drafts (
        sequence BIGSERIAL UNIQUE NOT NULL,
        id TEXT PRIMARY KEY,
        company_id INTEGER NOT NULL CHECK (company_id IN (1,2,3)),
        team_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        parent_id TEXT REFERENCES intranet_drafts(id),
        document JSONB NOT NULL,
        UNIQUE(parent_id,kind)
      )`;
      await transaction`CREATE INDEX IF NOT EXISTS intranet_drafts_company_team ON intranet_drafts(company_id,team_id)`;
      await transaction`CREATE TABLE IF NOT EXISTS intranet_draft_sequences (key TEXT PRIMARY KEY,value BIGINT NOT NULL)`;
      await transaction`CREATE TABLE IF NOT EXISTS intranet_create_requests (
        actor_id TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        request_key TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        draft_id TEXT NOT NULL REFERENCES intranet_drafts(id),
        PRIMARY KEY(actor_id,company_id,request_key)
      )`;
      await transaction`CREATE TABLE IF NOT EXISTS intranet_draft_audit (
        sequence BIGSERIAL PRIMARY KEY,
        id TEXT UNIQUE NOT NULL,
        draft_id TEXT NOT NULL REFERENCES intranet_drafts(id),
        entry JSONB NOT NULL
      )`;
      await transaction`CREATE INDEX IF NOT EXISTS intranet_draft_audit_draft ON intranet_draft_audit(draft_id,sequence)`;
      await transaction`CREATE OR REPLACE FUNCTION intranet_reject_draft_audit_change() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit bersifat append-only'; END; $$`;
      await transaction`CREATE TRIGGER intranet_draft_audit_no_change BEFORE UPDATE OR DELETE ON intranet_draft_audit
        FOR EACH ROW EXECUTE FUNCTION intranet_reject_draft_audit_change()`;
      await transaction`CREATE TRIGGER intranet_draft_audit_no_truncate BEFORE TRUNCATE ON intranet_draft_audit
        FOR EACH STATEMENT EXECUTE FUNCTION intranet_reject_draft_audit_change()`;
    }, this.sql);
  }

  async close(): Promise<void> {
    if (this.shared) await closeSql();
    else await this.sql.end({ timeout: 5 });
  }

  private async read(sql: Executor, id: string, locked = false): Promise<Draft> {
    const rows = locked
      ? await sql<DraftRow[]>`SELECT document FROM intranet_drafts WHERE id=${id} FOR UPDATE`
      : await sql<DraftRow[]>`SELECT document FROM intranet_drafts WHERE id=${id}`;
    if (!rows[0]) throw new WorkflowError("NOT_FOUND", "Draft tidak ditemukan.", 404);
    return rows[0].document;
  }
  private async getInside(sql: Executor, actor: Actor, id: string, locked = false): Promise<Draft> {
    const draft = await this.read(sql, id, locked);
    assertDraftAccess(actor, draft);
    return draft;
  }
  private async checkVersion(sql: Executor, draft: Draft, version: number): Promise<void> {
    if (draft.version !== version) throw new WorkflowError("VERSION_CONFLICT", "Draft telah berubah. Muat ulang sebelum menyimpan.", 409);
    if ((await sql`SELECT id FROM intranet_drafts WHERE parent_id=${draft.id} LIMIT 1`).length) throw new WorkflowError("DRAFT_HAS_SUCCESSOR", "Draft ini sudah memiliki dokumen lanjutan. Buka dokumen lanjutannya untuk perubahan.", 409);
  }
  private async write(sql: Executor, draft: Draft): Promise<void> {
    await sql`INSERT INTO intranet_drafts (id,company_id,team_id,owner_id,kind,parent_id,document)
      VALUES (${draft.id},${draft.companyId},${draft.teamId},${draft.ownerId},${draft.kind},${draft.parentId},${sql.json(draft as unknown as JSONValue)}::jsonb)
      ON CONFLICT(id) DO UPDATE SET document=excluded.document`;
  }
  private async appendAudit(sql: Executor, actor: Actor, action: string, before: Draft | null, after: Draft, reason: string): Promise<void> {
    const entry: AuditEntry = { id: randomUUID(), draftId: after.id, actorId: actor.userId, actorName: actor.name, action, reason, at: after.updatedAt, before, after };
    await sql`INSERT INTO intranet_draft_audit (id,draft_id,entry) VALUES (${entry.id},${entry.draftId},${sql.json(entry as unknown as JSONValue)}::jsonb)`;
  }
  private async number(sql: Executor, companyId: number, kind: DraftKind): Promise<string> {
    const key = `${companyId}:${kind}`;
    const [row] = await sql<{ value: string }[]>`INSERT INTO intranet_draft_sequences (key,value) VALUES (${key},1)
      ON CONFLICT(key) DO UPDATE SET value=intranet_draft_sequences.value+1 RETURNING value::text`;
    return `LOCAL-${COMPANIES.find(company => company.id === companyId)!.code}-${kind.replace("_", "-")}-${row.value.padStart(5, "0")}`;
  }

  async list(actor: Actor): Promise<Draft[]> {
    assertActor(actor); await this.ready();
    const rows = await this.sql<DraftRow[]>`SELECT document FROM intranet_drafts WHERE company_id=${actor.companyId} ORDER BY sequence DESC`;
    return rows.map(row => row.document).filter(draft => canSeeDraft(actor, draft));
  }
  async get(actor: Actor, id: string): Promise<Draft> {
    assertActor(actor); await this.ready();
    return this.getInside(this.sql, actor, id);
  }
  async create(actor: Actor, input: CreateDraftInput): Promise<Draft> {
    assertActor(actor);
    const parsed = validated(() => createSchema.parse(input));
    const kind = parsed.kind;
    const source = parsed.source == null ? null : validated(() => parseAccurateSource(kind, parsed.source));
    assertCreateKind(actor, kind, source !== null);
    const payload = safePayload(kind, parsed.payload);
    if (!source && payload.type === "transaction" && payload.lines.some(line => line.sourceLineId !== undefined)) throw new WorkflowError("SOURCE_LINE_MISMATCH", "Draft baru tidak boleh mengklaim referensi baris Accurate.", 400);
    if (kind === "ITEM_EDIT" && (!source || payload.type !== "item" || source.id !== payload.itemId)) throw new WorkflowError("SOURCE_REQUIRED", "Perubahan barang harus menggunakan referensi barang Accurate yang sama.", 400);
    if (kind === "CUSTOMER_EDIT" && (!source || payload.type !== "customer" || source.id !== payload.customerId)) throw new WorkflowError("SOURCE_REQUIRED", "Perubahan klien harus menggunakan referensi klien Accurate yang sama.", 400);
    const fingerprint = createHash("sha256").update(canonical({ kind, payload, source, reason: parsed.reason || "" })).digest("hex");
    await this.ready();
    return await this.sql.begin(async transaction => {
      if (parsed.requestId) {
        // Transaction-scoped lock makes concurrent retries across Vercel instances serialize.
        const requestLock = JSON.stringify([actor.userId, actor.companyId, parsed.requestId]);
        await transaction`SELECT pg_advisory_xact_lock(hashtext('gastro-intranet:create'),hashtext(${requestLock}))`;
        const [previous] = await transaction<{ fingerprint: string; draft_id: string }[]>`SELECT fingerprint,draft_id FROM intranet_create_requests
          WHERE actor_id=${actor.userId} AND company_id=${actor.companyId} AND request_key=${parsed.requestId}`;
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw new WorkflowError("IDEMPOTENCY_CONFLICT", "Permintaan penyimpanan ini sudah dipakai dengan isi berbeda. Muat ulang draft sebelum mencoba kembali.", 409);
          return this.getInside(transaction, actor, previous.draft_id);
        }
      }
      const now = new Date().toISOString();
      const teamId = actor.role === "master_admin" ? (kind === "PO" || kind.startsWith("ITEM") ? "importer" : "sales") : actor.teamId;
      const draft: Draft = { id: randomUUID(), number: await this.number(transaction, actor.companyId, kind), companyId: actor.companyId, kind, status: "DRAFT", ownerId: actor.userId, ownerName: actor.name, teamId, payload, version: 1, createdAt: now, updatedAt: now, source, parentId: null, reason: parsed.reason || "", approvedBy: null };
      await this.write(transaction, draft);
      await this.appendAudit(transaction, actor, "create", null, draft, draft.reason);
      if (parsed.requestId) await transaction`INSERT INTO intranet_create_requests (actor_id,company_id,request_key,fingerprint,draft_id)
        VALUES (${actor.userId},${actor.companyId},${parsed.requestId},${fingerprint},${draft.id})`;
      return draft;
    });
  }
  async update(actor: Actor, id: string, input: UpdateDraftInput): Promise<Draft> {
    assertActor(actor);
    const parsed = validated(() => updateSchema.parse(input));
    await this.ready();
    return await this.sql.begin(async transaction => {
      const before = await this.getInside(transaction, actor, id, true);
      assertEdit(actor, before);
      await this.checkVersion(transaction, before, parsed.version);
      const payload = safePayload(before.kind, parsed.payload);
      if (payload.type === "transaction" && before.payload.type === "transaction") {
        const originalLines = new Map(before.payload.lines.map(line => [line.id, line]));
        for (const line of payload.lines) {
          if (line.sourceLineId !== originalLines.get(line.id)?.sourceLineId) throw new WorkflowError("SOURCE_LINE_MISMATCH", "Referensi asli baris Accurate tidak boleh diganti atau ditambahkan pada baris baru.", 400);
        }
      }
      if (before.kind === "ITEM_EDIT" && payload.type === "item" && payload.itemId !== before.source?.id) throw new WorkflowError("SOURCE_MISMATCH", "Referensi barang Accurate tidak boleh diganti.", 400);
      if (before.kind === "CUSTOMER_EDIT" && payload.type === "customer" && payload.customerId !== before.source?.id) throw new WorkflowError("SOURCE_MISMATCH", "Referensi klien Accurate tidak boleh diganti.", 400);
      const draft: Draft = { ...before, payload, status: "DRAFT", approvedBy: null, version: before.version + 1, updatedAt: new Date().toISOString(), reason: parsed.reason || "" };
      await this.write(transaction, draft);
      await this.appendAudit(transaction, actor, "update", before, draft, draft.reason);
      return draft;
    });
  }
  async transition(actor: Actor, id: string, input: TransitionDraftInput): Promise<Draft> {
    assertActor(actor);
    const parsed = validated(() => transitionSchema.parse(input));
    await this.ready();
    return await this.sql.begin(async transaction => {
      const before = await this.getInside(transaction, actor, id, true);
      await this.checkVersion(transaction, before, parsed.version);
      const reason = parsed.reason || "";
      assertTransition(actor, before, parsed.action, reason);
      if (["submit", "approve", "promote"].includes(parsed.action)) safePayload(before.kind, before.payload, true);
      const now = new Date().toISOString();
      if (parsed.action === "promote" || parsed.action === "demote") {
        const kind = parsed.action === "promote" ? "SO" : "SQ";
        const parent: Draft = { ...before, updatedAt: now, version: before.version + 1, reason };
        await this.write(transaction, parent);
        await this.appendAudit(transaction, actor, `${parsed.action}_source`, before, parent, reason);
        const child: Draft = { ...before, id: randomUUID(), number: await this.number(transaction, before.companyId, kind), kind, status: "DRAFT", source: null, parentId: before.id, approvedBy: null, version: 1, createdAt: now, updatedAt: now, reason };
        await this.write(transaction, child);
        await this.appendAudit(transaction, actor, parsed.action, null, child, reason);
        return child;
      }
      const status = parsed.action === "submit" ? "SUBMITTED" : parsed.action === "approve" ? "APPROVED" : parsed.action === "revise" ? "REVISION" : "DRAFT";
      const draft: Draft = { ...before, status, approvedBy: status === "APPROVED" ? actor.userId : null, version: before.version + 1, updatedAt: now, reason };
      await this.write(transaction, draft);
      await this.appendAudit(transaction, actor, parsed.action, before, draft, reason);
      return draft;
    });
  }
  async audit(actor: Actor, id: string): Promise<AuditEntry[]> {
    await this.get(actor, id);
    const rows = await this.sql<{ entry: AuditEntry }[]>`SELECT entry FROM intranet_draft_audit WHERE draft_id=${id} ORDER BY sequence DESC`;
    return rows.map(row => row.entry);
  }
  async auditAll(actor: Actor): Promise<AuditEntry[]> {
    assertActor(actor); await this.ready();
    const allowed = new Set((await this.list(actor)).map(draft => draft.id));
    const rows = await this.sql<{ entry: AuditEntry }[]>`SELECT audit.entry FROM intranet_draft_audit AS audit
      JOIN intranet_drafts ON audit.draft_id=intranet_drafts.id WHERE intranet_drafts.company_id=${actor.companyId} ORDER BY audit.sequence DESC`;
    return rows.map(row => row.entry).filter(entry => allowed.has(entry.draftId));
  }
}
