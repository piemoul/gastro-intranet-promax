import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import postgres, { type Sql } from "postgres";
import { PgDraftStore } from "../src/server/pg-store";
import { createSql, ensureSchema } from "../src/server/postgres";
import { WorkflowError } from "../src/server/workflow";
import { emptyTransaction, emptyItem, emptyCustomer, type Actor, type Role, type TransactionPayload } from "../src/lib/domain";

// CI may provide a dedicated PostgreSQL service. Live verification must opt in
// explicitly; the normal unit-test command never connects using DATABASE_URL.
const databaseUrl = process.env.INTRANET_TEST_DATABASE_URL;
const actor = (role: Role, userId = role as string, companyId: 1 | 2 = 1): Actor => ({ userId, name: userId, role, companyId, companyIds: [1, 2], teamId: role === "master_admin" ? "all" : role === "sales" || role === "head_sales" ? "sales" : "importer" });
const sales = actor("sales"), head = actor("head_sales"), importer = actor("importer"), headImporter = actor("head_importer"), admin = actor("master_admin");
function payload(): TransactionPayload { return { ...emptyTransaction(), date: "2026-09-24", partnerId: 17, partnerNo: "C-17", partnerName: "Verification fixture", lines: [{ id: "line-one", itemId: 32, itemNo: "I-32", name: "Fixture item", unit: "PCS", quantity: 2, unitPrice: 100, discountPercent: 0, taxPercent: 12, taxBasePercent: 91.666667, warehouse: "Utama", notes: "" }] }; }
function entryPayload():TransactionPayload {const p=payload();return {...p,lines:p.lines.map(l=>({...l,unitPrice:0,taxPercent:0,taxBasePercent:100,warehouse:""}))};}
const code = (expected: string) => (error: unknown) => error instanceof WorkflowError && error.code === expected;

function scopedSql(url: string, schema: string): Sql {
  const scoped = new URL(url);
  scoped.searchParams.set("search_path", schema);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(scoped.hostname);
  return postgres(scoped.toString(), { max: 5, prepare: false, ssl: local ? false : "verify-full", connect_timeout: 15, idle_timeout: 5, onnotice: () => undefined, connection: { application_name: "intranet-storage-verification", search_path: schema } });
}

test("PostgreSQL persistence, permissions, concurrency and rollback in an isolated temporary schema", { skip: !databaseUrl, timeout: 180_000 }, async t => {
  const control = createSql(databaseUrl!);
  const schema = `intranet_drafts_test_${randomUUID().replaceAll("-", "")}`;
  let firstSql: Sql | undefined, secondSql: Sql | undefined;
  try {
    await control`CREATE SCHEMA ${control(schema)}`;
    firstSql = scopedSql(databaseUrl!, schema); secondSql = scopedSql(databaseUrl!, schema);
    for (const connection of [firstSql, secondSql]) {
      const [scope] = await connection<{ current_schema: string }[]>`SELECT current_schema()`;
      assert.equal(scope.current_schema, schema, "Verification must not run outside its temporary schema");
    }
    const first = new PgDraftStore(firstSql), second = new PgDraftStore(secondSql);
    await Promise.all([first.ready(), second.ready()]);
    const sql = firstSql;

    await t.test("permissions, company boundary and master-created business teams", async () => {
      const draft = await first.create(sales, { kind: "SQ", payload: entryPayload() });
      for (const unauthorized of [actor("sales", "another-sales"), { ...head, teamId: "other-team" }, importer, headImporter, { ...head, companyId: 2 as const }]) {
        assert.equal((await first.list(unauthorized)).some(row => row.id === draft.id), false);
        await assert.rejects(first.get(unauthorized, draft.id), code("FORBIDDEN"));
        await assert.rejects(first.audit(unauthorized, draft.id), code("FORBIDDEN"));
        await assert.rejects(first.update(unauthorized, draft.id, { version: 1, payload: payload() }), code("FORBIDDEN"));
      }
      await assert.rejects(first.create(sales, { kind: "PO", payload: payload() }), code("FORBIDDEN"));
      await assert.rejects(first.create(importer, { kind: "SQ", payload: payload() }), code("FORBIDDEN"));
      const adminQuote = await first.create(admin, { kind: "SQ", payload: payload() });
      const adminPo = await first.create(admin, { kind: "PO", payload: payload() });
      assert.equal(adminQuote.teamId, "sales"); assert.equal(adminPo.teamId, "importer");
      assert.equal((await first.get(head, adminQuote.id)).id, adminQuote.id); assert.equal((await first.get(headImporter, adminPo.id)).id, adminPo.id);
    });

    await t.test("concurrent create retries share one durable draft, sequence and audit", async () => {
      const original = { ...payload(), customFields: { charField2: "Second", charField1: "First" } };
      const [a, b] = await Promise.all([
        first.create(head, { kind: "SQ", payload: original, requestId: "concurrent-create" }),
        second.create(head, { kind: "SQ", payload: { ...original, customFields: { charField1: "First", charField2: "Second" } }, requestId: "concurrent-create" }),
      ]);
      assert.deepEqual(a, b); assert.equal((await first.audit(head, a.id)).length, 1);
      await assert.rejects(second.create(head, { kind: "SQ", payload: { ...original, reference: "changed" }, requestId: "concurrent-create" }), code("IDEMPOTENCY_CONFLICT"));
      const otherCompany = await first.create({ ...head, companyId: 2 }, { kind: "SQ", payload: original, requestId: "concurrent-create" });
      assert.notEqual(otherCompany.id, a.id);
      const results = await Promise.allSettled([
        first.update(head, a.id, { version: 1, payload: { ...original, reference: "race-a" } }),
        second.update(head, a.id, { version: 1, payload: { ...original, reference: "race-b" } }),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      const rejected = results.find(result => result.status === "rejected"); assert.ok(rejected?.status === "rejected" && code("VERSION_CONFLICT")(rejected.reason));
      const current = await second.get(head, a.id); assert.equal(current.version, 2); assert.equal((await second.audit(head, a.id)).length, 2);
      assert.deepEqual(await first.create(head, { kind: "SQ", payload: original, requestId: "concurrent-create" }), current);
    });

    await t.test("approval, atomic edits, lineage and concurrent promotion parity", async () => {
      const draft = await first.create(sales, { kind: "SQ", payload: entryPayload() });
      const submitted = await first.transition(sales, draft.id, { version: 1, action: "submit" });
      await assert.rejects(first.transition(sales, draft.id, { version: 2, action: "approve" }), code("FORBIDDEN"));
      const reviewed = await first.update(head,draft.id,{version:submitted.version,payload:{...payload(),sqDetails:{subject:"",pic:"",validity:"",delivery:"",installation:"",warranty:"",franco:"",pricingReviewed:true}}});
      const ready=await first.transition(head,draft.id,{version:reviewed.version,action:"submit"});
      await assert.rejects(second.transition(head,draft.id,{version:ready.version,action:"approve"}),code("FORBIDDEN"));
      let approved = await second.transition(admin, draft.id, { version: ready.version, action: "approve" });
      approved=await first.reservePublication(admin,approved.id,approved.version);
      approved=await first.completePublication(head,approved.id,approved.publication!.attemptId,{outcome:"published",id:79,number:"SQ079"});
      const attempts = await Promise.allSettled([
        first.transition(head, draft.id, { version: approved.version, action: "promote" }),
        second.transition(head, draft.id, { version: approved.version, action: "promote" }),
      ]);
      const success = attempts.find(result => result.status === "fulfilled"); assert.ok(success?.status === "fulfilled");
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      const order = success.value; assert.equal(order.kind, "SO"); assert.equal(order.ownerId, sales.userId); assert.equal(order.parentId, draft.id);
      const predecessor = await first.get(head, draft.id);
      await assert.rejects(first.update(head, draft.id, { version: predecessor.version, payload: payload() }), code("PUBLICATION_LOCKED"));
      await assert.rejects(first.transition(head, order.id, { version: 1, action: "demote" }), code("REASON_REQUIRED"));
      const revision = await second.transition(head, order.id, { version: 1, action: "demote", reason: "Verification only" });
      assert.equal(revision.kind, "SQ"); assert.equal(revision.parentId, order.id);
      assert.equal((await first.audit(head, order.id))[0].action, "demote_source");
      const orderSource = await first.create(head, { kind: "SO", payload: payload(), source: { kind: "SO", id: 10, number: "Fixture-source", fingerprint: "fixture" } });
      await assert.rejects(first.transition(admin, orderSource.id, { version: 1, action: "demote", reason: "Disallowed" }), code("ACCURATE_READ_ONLY"));
      const po = await first.create(importer, { kind: "PO", payload: payload() });
      const sent = await first.transition(importer, po.id, { version: 1, action: "submit" });
      const accepted = await first.transition(headImporter, po.id, { version: sent.version, action: "approve" });
      const changed = await first.update(headImporter, po.id, { version: accepted.version, payload: payload() });
      assert.equal(changed.status, "DRAFT"); assert.equal(changed.approvedBy, null);
    });

    await t.test("concurrent selection through two references cannot create two SO for one Accurate SQ",async()=>{
      const source={kind:"SQ" as const,id:179,number:"SQ179",fingerprint:"fixture"};
      const a=await first.create(head,{kind:"SQ",payload:payload(),source});
      const b=await second.create(head,{kind:"SQ",payload:payload(),source});
      const results=await Promise.allSettled([
        first.transition(head,a.id,{version:1,action:"promote"}),
        second.transition(head,b.id,{version:1,action:"promote"}),
      ]);
      assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
      const failure=results.find(r=>r.status==="rejected");assert.ok(failure?.status==="rejected");
      assert.equal(failure.reason.code,"QUOTATION_ALREADY_SELECTED");
    });

    await t.test("validation, source-line integrity and master proposal roles", async () => {
      const partial = await first.create(importer, { kind: "PO", payload: emptyTransaction() });
      await assert.rejects(first.transition(importer, partial.id, { version: 1, action: "submit" }), code("VALIDATION"));
      assert.equal((await first.audit(importer, partial.id)).length, 1);
      const original = payload(); original.lines[0].sourceLineId = 700; original.lines[0].project = "Fixture project"; original.lines[0].department = "Fixture department"; original.lines[0].customFields = { charField1: "Custom" };
      await assert.rejects(first.create(head, { kind: "SQ", payload: original }), code("SOURCE_LINE_MISMATCH"));
      const sourced = await first.create(head, { kind: "SO", payload: original, source: { kind: "SO", id: 7, number: "Fixture-source", fingerprint: "fixture" } });
      const forged = structuredClone(original); forged.lines[0].sourceLineId = 701;
      await assert.rejects(first.update(head, sourced.id, { version: 1, payload: forged }), code("SOURCE_LINE_MISMATCH"));
      const saved = await first.update(head, sourced.id, { version: 1, payload: original });
      assert.equal(saved.payload.type, "transaction");
      if (saved.payload.type === "transaction") assert.equal(saved.payload.lines[0].sourceLineId, 700);
      const item = { ...emptyItem(), no: "Fixture-item", name: "Fixture", unit: "PCS" };
      const customer = { ...emptyCustomer(), no: "Fixture-client", name: "Fixture" };
      await assert.rejects(first.create(head, { kind: "ITEM_CREATE", payload: item }), code("FORBIDDEN"));
      await assert.rejects(first.create(headImporter, { kind: "CUSTOMER_CREATE", payload: customer }), code("FORBIDDEN"));
      await first.create(headImporter, { kind: "ITEM_CREATE", payload: item });
      await first.create(head, { kind: "CUSTOMER_CREATE", payload: customer });
      const edited = await first.create(headImporter, { kind: "ITEM_EDIT", payload: { ...item, itemId: 8 }, source: { kind: "ITEM", id: 8, number: "Fixture-item", fingerprint: "fixture" } });
      await assert.rejects(first.update(headImporter, edited.id, { version: 1, payload: { ...item, itemId: 9 } }), code("SOURCE_MISMATCH"));
    });

    await t.test("append-only audit and atomic rollback leave no partial draft or consumed request", async () => {
      const draft = await first.create(sales, { kind: "SQ", payload: entryPayload() });
      await assert.rejects(sql`UPDATE intranet_draft_audit SET entry='{}'::jsonb WHERE draft_id=${draft.id}`, /append-only/);
      await assert.rejects(sql`DELETE FROM intranet_draft_audit WHERE draft_id=${draft.id}`, /append-only/);
      await assert.rejects(sql`TRUNCATE intranet_draft_audit`, /append-only/);
      await sql`CREATE FUNCTION intranet_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fixture audit rejection'; END; $$`;
      await sql`CREATE TRIGGER intranet_test_reject_audit BEFORE INSERT ON intranet_draft_audit FOR EACH ROW EXECUTE FUNCTION intranet_test_reject_audit()`;
      await assert.rejects(first.update(sales, draft.id, { version: 1, payload: { ...entryPayload(), description: "must rollback" } }), /Fixture audit rejection/);
      await assert.rejects(first.create(sales, { kind: "SQ", payload: entryPayload(), requestId: "retry-after-failure" }), /Fixture audit rejection/);
      await sql`DROP TRIGGER intranet_test_reject_audit ON intranet_draft_audit`;
      assert.deepEqual(await first.get(sales, draft.id), draft); assert.equal((await first.audit(sales, draft.id)).length, 1);
      const retry = await second.create(sales, { kind: "SQ", payload: entryPayload(), requestId: "retry-after-failure" });
      assert.equal((await first.audit(sales, retry.id)).length, 1);
      assert.equal(Number(retry.number.split("-").at(-1)), Number(draft.number.split("-").at(-1)) + 1);
    });

    await t.test("publication reservation is exclusive across connections and survives uncertain outcomes", async () => {
      let d=await first.create(importer,{kind:"PO",payload:payload()});
      d=await first.transition(importer,d.id,{version:d.version,action:"submit"});
      d=await first.transition(headImporter,d.id,{version:d.version,action:"approve"});
      const outcomes=await Promise.allSettled([first.reservePublication(headImporter,d.id,d.version),second.reservePublication(headImporter,d.id,d.version)]);
      assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
      const reserved=await second.get(headImporter,d.id);assert.equal(reserved.status,"PUBLISHING");
      await assert.rejects(second.update(admin,d.id,{version:reserved.version,payload:payload()}),code("PUBLICATION_LOCKED"));
      const uncertain=await first.completePublication(headImporter,d.id,reserved.publication!.attemptId,{outcome:"uncertain",error:"Fixture timeout"});
      await assert.rejects(second.reservePublication(headImporter,d.id,uncertain.version),code("PUBLICATION_STATUS"));
      const published=await second.completePublication(headImporter,d.id,reserved.publication!.attemptId,{outcome:"published",id:800,number:"FIXTURE-PO800"});
      assert.equal((await first.get(headImporter,d.id)).publication?.accurateNumber,"FIXTURE-PO800");
      await assert.rejects(first.transition(admin,d.id,{version:published.version,action:"reopen",reason:"Fixture"}),code("PUBLICATION_LOCKED"));
      assert.equal((await first.completePublication(headImporter,d.id,reserved.publication!.attemptId,{outcome:"uncertain",error:"Late failure"})).status,"PUBLISHED");
      assert.deepEqual((await first.audit(headImporter,d.id)).slice(0,3).map(e=>e.action),["accurate_published","accurate_uncertain","accurate_reserved"]);
    });

    await t.test("a failed schema migration rolls back and is retryable", async () => {
      await assert.rejects(ensureSchema("failed-verification-v1", async transaction => {
        await transaction`CREATE TABLE intranet_failed_verification (id INTEGER)`;
        throw new Error("Fixture migration rejection");
      }, sql), /Fixture migration rejection/);
      const [missing] = await sql<{ table_name: string | null }[]>`SELECT to_regclass('intranet_failed_verification')::text AS table_name`;
      assert.equal(missing.table_name, null);
      await ensureSchema("failed-verification-v1", async transaction => { await transaction`CREATE TABLE intranet_failed_verification (id INTEGER)`; }, sql);
      const [applied] = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM intranet_schema_migrations WHERE version='failed-verification-v1'`;
      assert.equal(applied.count, "1");
    });
  } finally {
    await Promise.all([firstSql?.end({ timeout: 5 }), secondSql?.end({ timeout: 5 })]);
    // schema is always generated locally, never from a user or environment value.
    if (!/^intranet_drafts_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe verification schema");
    await control`DROP SCHEMA IF EXISTS ${control(schema)} CASCADE`;
    await control.end({ timeout: 5 });
  }
});
