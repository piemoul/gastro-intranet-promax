import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DraftStore, WorkflowError } from "../src/server/store";
import { emptyTransaction, emptyItem, emptyCustomer, type Actor, type Draft, type TransactionPayload, type Role } from "../src/lib/domain";

const actor = (role:Role, userId:string=role, teamId="team-a", companyId:1|2|3=1):Actor => ({userId,name:userId,role,teamId,companyId,companyIds:[1,2]});
const sales = actor("sales"), headSales = actor("head_sales"), importer = actor("importer"), headImporter = actor("head_importer"), admin = actor("master_admin","admin","central");
function payload():TransactionPayload {
  return {...emptyTransaction(),date:"2026-09-24",partnerId:17,partnerNo:"C-017",partnerName:"Customer",lines:[{id:"line-1",itemId:32,itemNo:"SKU-32",name:"Refrigerator",unit:"PCS",quantity:2,unitPrice:100,discountPercent:0,taxPercent:11,warehouse:"Utama",notes:""}]};
}
const code = (expected:string) => (error:unknown) => error instanceof WorkflowError && error.code === expected;
function approved(store:DraftStore,kind:"PO"|"SQ"="SQ"):Draft {
  const staff = kind === "PO" ? importer : sales;
  const head = kind === "PO" ? headImporter : headSales;
  const draft = store.create(staff,{kind,payload:payload()});
  const submitted = store.transition(staff,draft.id,{version:draft.version,action:"submit"});
  return store.transition(head,draft.id,{version:submitted.version,action:"approve"});
}

test("role, company, team and ownership boundaries apply to reads, writes and audits", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = store.create(sales,{kind:"SQ",payload:payload()});
    for (const unauthorized of [actor("sales","different-user"),actor("head_sales","head","other-team"),importer,headImporter,actor("head_sales","head","team-a",2)]) {
      assert.equal(store.list(unauthorized).length,0);
      assert.throws(() => store.get(unauthorized,draft.id),code("FORBIDDEN"));
      assert.throws(() => store.audit(unauthorized,draft.id),code("FORBIDDEN"));
      assert.throws(() => store.update(unauthorized,draft.id,{version:1,payload:payload()}),code("FORBIDDEN"));
    }
    assert.equal(store.list(headSales).length,1);
    assert.equal(store.list(admin).length,1);
    assert.equal(store.list({...admin,companyId:2}).length,0);
    assert.throws(() => store.list({...admin,companyId:3}),code("UNAUTHENTICATED"));
    assert.throws(() => store.create(sales,{kind:"PO",payload:payload()}),code("FORBIDDEN"));
    assert.throws(() => store.create(importer,{kind:"SQ",payload:payload()}),code("FORBIDDEN"));
  } finally { store.close(); }
});

test("draft payload identity cannot forge company, author, role or status", () => {
  const store = new DraftStore(":memory:");
  try {
    for (const extra of [{ownerId:"someone"},{companyId:2},{role:"master_admin"},{status:"APPROVED"}]) {
      assert.throws(() => store.create(sales,{kind:"SQ",payload:payload(),...extra}),code("VALIDATION"));
    }
    assert.throws(() => store.create(sales,{kind:"SQ",payload:payload(),source:{kind:"SQ",id:10,number:"SQ10",fingerprint:"hash"}}),code("FORBIDDEN"));
    assert.equal(store.list(sales).length,0);
  } finally { store.close(); }
});

test("partial draft can be saved, but submission rejects missing fields and malformed IDs", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = store.create(importer,{kind:"PO",payload:emptyTransaction()});
    assert.throws(() => store.transition(importer,draft.id,{version:1,action:"submit"}),code("VALIDATION"));
    assert.equal(store.get(importer,draft.id).version,1);
    assert.equal(store.audit(importer,draft.id).length,1);
    const invalid = payload(); invalid.lines[0].itemId = 0;
    assert.throws(() => store.create(importer,{kind:"PO",payload:invalid}),code("VALIDATION"));
    const badDate = {...payload(),date:"2026-02-31"};
    assert.throws(() => store.create(importer,{kind:"PO",payload:badDate}),code("VALIDATION"));
    const duplicate = payload(); duplicate.lines.push({...duplicate.lines[0]});
    assert.throws(() => store.create(importer,{kind:"PO",payload:duplicate}),code("VALIDATION"));
  } finally { store.close(); }
});

test("all edits and transitions require optimistic versions and reset approval atomically", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = approved(store,"PO");
    assert.equal(draft.status,"APPROVED");
    assert.equal(draft.approvedBy,headImporter.userId);
    assert.throws(() => store.update(importer,draft.id,{version:draft.version,payload:payload()}),code("FORBIDDEN"));
    assert.throws(() => store.update(headImporter,draft.id,{version:1,payload:payload()}),code("VERSION_CONFLICT"));
    const changed = store.update(headImporter,draft.id,{version:draft.version,payload:{...payload(),reference:"New reference"}});
    assert.equal(changed.status,"DRAFT"); assert.equal(changed.approvedBy,null); assert.equal(changed.version,4);
    const entries = store.audit(headImporter,draft.id);
    assert.deepEqual(entries.map(entry => entry.action),["update","approve","submit","create"]);
    assert.equal(entries[0].before?.status,"APPROVED"); assert.equal(entries[0].after?.status,"DRAFT");
    assert.throws(() => store.transition(headImporter,draft.id,{version:4,action:"approve"}),code("INVALID_TRANSITION"));
    assert.equal(store.audit(headImporter,draft.id).length,4);
  } finally { store.close(); }
});

test("only matching heads approve; revisions require reasons and author can revise own document", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = store.create(sales,{kind:"SQ",payload:payload()});
    const submitted = store.transition(sales,draft.id,{version:1,action:"submit"});
    assert.throws(() => store.transition(sales,draft.id,{version:2,action:"approve"}),code("FORBIDDEN"));
    assert.throws(() => store.transition(headImporter,draft.id,{version:2,action:"approve"}),code("FORBIDDEN"));
    assert.throws(() => store.transition(headSales,draft.id,{version:2,action:"revise",reason:"  "}),code("REASON_REQUIRED"));
    const revision = store.transition(headSales,draft.id,{version:submitted.version,action:"revise",reason:"Periksa harga"});
    assert.equal(revision.status,"REVISION");
    const changed = store.update(sales,draft.id,{version:revision.version,payload:payload()});
    assert.equal(changed.status,"DRAFT");
  } finally { store.close(); }
});

test("approved SQ promotion and local SO reversal preserve lineage and freeze predecessors", () => {
  const store = new DraftStore(":memory:");
  try {
    const quotation = approved(store);
    assert.throws(() => store.create(headSales,{kind:"SO",payload:payload()}),code("SO_REQUIRES_QUOTATION"));
    const order = store.transition(headSales,quotation.id,{version:quotation.version,action:"promote"});
    assert.equal(order.kind,"SO"); assert.equal(order.status,"DRAFT"); assert.equal(order.parentId,quotation.id);
    assert.equal(order.ownerId,sales.userId); assert.equal(order.source,null);
    const parent = store.get(headSales,quotation.id);
    assert.equal(parent.version,quotation.version+1);
    assert.throws(() => store.transition(headSales,parent.id,{version:parent.version,action:"promote"}),code("DRAFT_HAS_SUCCESSOR"));
    assert.throws(() => store.update(headSales,parent.id,{version:parent.version,payload:payload()}),code("DRAFT_HAS_SUCCESSOR"));
    assert.throws(() => store.update(sales,order.id,{version:1,payload:payload()}),code("FORBIDDEN"));
    assert.throws(() => store.transition(headSales,order.id,{version:1,action:"demote"}),code("REASON_REQUIRED"));
    const revision = store.transition(headSales,order.id,{version:1,action:"demote",reason:"Negosiasi ulang"});
    assert.equal(revision.kind,"SQ"); assert.equal(revision.parentId,order.id); assert.equal(revision.status,"DRAFT");
    assert.equal(store.audit(headSales,order.id)[0].action,"demote_source");
    assert.equal(store.audit(headSales,quotation.id)[0].action,"promote_source");
    assert.equal(store.auditAll(admin).length,7);
  } finally { store.close(); }
});

test("Accurate source SO reversal is always forbidden, including master admin", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = store.create(headSales,{kind:"SO",payload:payload(),source:{kind:"SO",id:8,number:"SO-008",fingerprint:"verified-server-hash"}});
    assert.throws(() => store.transition(admin,draft.id,{version:1,action:"demote",reason:"Revisi"}),code("ACCURATE_READ_ONLY"));
    assert.equal(store.audit(admin,draft.id).length,1);
    assert.equal(store.get(admin,draft.id).version,1);
  } finally { store.close(); }
});

test("master admin may approve across teams but only within an allowed active company", () => {
  const store = new DraftStore(":memory:");
  try {
    const draft = store.create(importer,{kind:"PO",payload:payload()});
    const submitted = store.transition(importer,draft.id,{version:1,action:"submit"});
    const approval = store.transition(admin,draft.id,{version:submitted.version,action:"approve"});
    assert.equal(approval.status,"APPROVED");
    assert.equal(approval.approvedBy,admin.userId);
    assert.throws(() => store.transition({...admin,companyId:2},draft.id,{version:approval.version,action:"reopen",reason:"Review"}),code("FORBIDDEN"));
  } finally { store.close(); }
});

test("master item proposals belong to importer heads; customer proposals belong to sales heads", () => {
  const store = new DraftStore(":memory:");
  try {
    const item = {...emptyItem(),no:"ITEM-X",name:"Item X",unit:"PCS"};
    const customer = {...emptyCustomer(),no:"CLIENT-X",name:"Client X"};
    for (const staff of [sales,headSales,importer]) assert.throws(() => store.create(staff,{kind:"ITEM_CREATE",payload:item}),code("FORBIDDEN"));
    for (const staff of [sales,importer,headImporter]) assert.throws(() => store.create(staff,{kind:"CUSTOMER_CREATE",payload:customer}),code("FORBIDDEN"));
    const itemDraft = store.create(headImporter,{kind:"ITEM_CREATE",payload:item});
    const customerDraft = store.create(headSales,{kind:"CUSTOMER_CREATE",payload:customer});
    assert.equal(store.list(admin).length,2);
    assert.equal(store.list(headSales)[0].id,customerDraft.id);
    assert.equal(store.list(headImporter)[0].id,itemDraft.id);
    assert.throws(() => store.create(headImporter,{kind:"ITEM_EDIT",payload:{...item,itemId:10}}),code("SOURCE_REQUIRED"));
    const itemEdit = store.create(admin,{kind:"ITEM_EDIT",payload:{...item,itemId:10},source:{kind:"ITEM",id:10,number:"ITEM-X",fingerprint:"hash"}});
    assert.throws(() => store.update(admin,itemEdit.id,{version:1,payload:{...item,itemId:11}}),code("SOURCE_MISMATCH"));
    const clientEdit = store.create(headSales,{kind:"CUSTOMER_EDIT",payload:{...customer,customerId:22},source:{kind:"CUSTOMER",id:22,number:"CLIENT-X",fingerprint:"hash"}});
    assert.throws(() => store.update(headSales,clientEdit.id,{version:1,payload:{...customer,customerId:23}}),code("SOURCE_MISMATCH"));
    assert.throws(() => store.create(headSales,{kind:"CUSTOMER_CREATE",payload:{...customer,email:"not-an-email"}}),code("VALIDATION"));
  } finally { store.close(); }
});

test("separate database connections preserve OCC, durable state, and append-only audit", () => {
  const dir = mkdtempSync(join(tmpdir(),"intranet-workflow-"));
  const file = join(dir,"intranet.sqlite");
  const first = new DraftStore(file), second = new DraftStore(file);
  try {
    const draft = first.create(sales,{kind:"SQ",payload:payload()});
    second.update(headSales,draft.id,{version:1,payload:{...payload(),reference:"winner"}});
    assert.throws(() => first.update(sales,draft.id,{version:1,payload:{...payload(),reference:"stale"}}),code("VERSION_CONFLICT"));
    assert.equal(first.get(sales,draft.id).version,2);
    assert.equal(first.audit(sales,draft.id).length,2);
    const sql = new DatabaseSync(file);
    try {
      assert.throws(() => sql.exec("DELETE FROM audit"),/append-only/);
      assert.throws(() => sql.exec("UPDATE audit SET entry = '{}'"),/append-only/);
    } finally { sql.close(); }
  } finally { first.close(); second.close(); rmSync(dir,{recursive:true,force:true}); }
});

test("WMS paths are not valid local draft database targets", () => {
  assert.throws(() => new DraftStore("/tmp/gastro-wms/intranet.sqlite"),/WMS/);
});

test("an audit write failure rolls back the draft update in the same transaction", () => {
  const dir = mkdtempSync(join(tmpdir(),"intranet-audit-"));
  const file = join(dir,"intranet.sqlite");
  const store = new DraftStore(file);
  const sql = new DatabaseSync(file);
  try {
    const draft = store.create(sales,{kind:"SQ",payload:payload()});
    sql.exec("CREATE TRIGGER simulate_audit_failure BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'Simulated audit failure'); END");
    assert.throws(() => store.update(sales,draft.id,{version:1,payload:{...payload(),reference:"must rollback"}}),/Simulated audit failure/);
    const unchanged = store.get(sales,draft.id);
    assert.equal(unchanged.version,1);
    assert.deepEqual(unchanged,draft);
    assert.equal(store.audit(sales,draft.id).length,1);
  } finally { store.close(); sql.close(); rmSync(dir,{recursive:true,force:true}); }
});

test("sourced line identities and optional commercial fields survive edits without accepting forged references", () => {
  const store=new DraftStore(":memory:");
  try {
    const original=payload();
    original.lines[0]={...original.lines[0],sourceLineId:700,project:"Project Seven",department:"Sales",customFields:{charField1:"Custom note"}};
    assert.throws(()=>store.create(headSales,{kind:"SQ",payload:original}),code("SOURCE_LINE_MISMATCH"));
    const draft=store.create(headSales,{kind:"SQ",payload:original,source:{kind:"SQ",id:77,number:"SQ-77",fingerprint:"hash"}});
    const replaced=structuredClone(original); replaced.lines[0].sourceLineId=701;
    assert.throws(()=>store.update(headSales,draft.id,{version:1,payload:replaced}),code("SOURCE_LINE_MISMATCH"));
    const removed=structuredClone(original); delete removed.lines[0].sourceLineId;
    assert.throws(()=>store.update(headSales,draft.id,{version:1,payload:removed}),code("SOURCE_LINE_MISMATCH"));
    const moved=structuredClone(original); moved.lines[0].id="different-id";
    assert.throws(()=>store.update(headSales,draft.id,{version:1,payload:moved}),code("SOURCE_LINE_MISMATCH"));
    const added=structuredClone(original); added.lines.push({...payload().lines[0],id:"new-local-row"});
    const updated=store.update(headSales,draft.id,{version:1,payload:added});
    assert.equal(updated.payload.type,"transaction");
    if(updated.payload.type!=="transaction")throw new Error("Expected transaction");
    assert.equal(updated.payload.lines[0].sourceLineId,700);
    assert.equal(updated.payload.lines[0].project,"Project Seven");
    assert.deepEqual(updated.payload.lines[0].customFields,{charField1:"Custom note"});
    assert.equal(updated.payload.lines[1].sourceLineId,undefined);
  }finally{store.close();}
});

test("create idempotency returns the same durable draft and audit for semantically identical retries", () => {
  const dir=mkdtempSync(join(tmpdir(),"intranet-idempotency-"));
  const first=new DraftStore(join(dir,"drafts.sqlite")),second=new DraftStore(join(dir,"drafts.sqlite"));
  try {
    const original={...payload(),customFields:{charField2:"Second",charField1:"First"}};
    const draft=first.create(sales,{kind:"SQ",payload:original,requestId:"request-1"});
    const retry=second.create(sales,{requestId:"request-1",payload:{...payload(),customFields:{charField1:"First",charField2:"Second"}},kind:"SQ"});
    assert.deepEqual(retry,draft);
    assert.equal(first.list(sales).length,1);
    assert.equal(first.audit(sales,draft.id).length,1);
    assert.throws(()=>second.create(sales,{kind:"SQ",payload:{...original,reference:"changed"},requestId:"request-1"}),code("IDEMPOTENCY_CONFLICT"));
    assert.throws(()=>second.create(sales,{kind:"SQ",payload:original,reason:"different reason",requestId:"request-1"}),code("IDEMPOTENCY_CONFLICT"));
    assert.equal(first.audit(sales,draft.id).length,1);
    const updated=first.update(sales,draft.id,{version:1,payload:{...original,reference:"later edit"}});
    assert.deepEqual(second.create(sales,{kind:"SQ",payload:original,requestId:"request-1"}),updated);
    const otherCompany=second.create({...sales,companyId:2},{kind:"SQ",payload:original,requestId:"request-1"});
    assert.notEqual(otherCompany.id,draft.id);
    const otherActor=second.create(actor("sales","second-sales"),{kind:"SQ",payload:original,requestId:"request-1"});
    assert.notEqual(otherActor.id,draft.id);
  }finally{first.close();second.close();rmSync(dir,{recursive:true,force:true});}
});

test("failed creation does not consume its idempotency key", () => {
  const dir=mkdtempSync(join(tmpdir(),"intranet-idempotency-rollback-"));
  const file=join(dir,"drafts.sqlite");
  const store=new DraftStore(file),sql=new DatabaseSync(file);
  try {
    sql.exec("CREATE TRIGGER simulate_create_failure BEFORE INSERT ON create_requests BEGIN SELECT RAISE(ABORT,'Create request failure'); END");
    assert.throws(()=>store.create(sales,{kind:"SQ",payload:payload(),requestId:"retry-after-failure"}),/Create request failure/);
    assert.equal(store.list(sales).length,0);
    sql.exec("DROP TRIGGER simulate_create_failure");
    const draft=store.create(sales,{kind:"SQ",payload:payload(),requestId:"retry-after-failure"});
    assert.equal(store.list(sales).length,1);
    assert.equal(store.audit(sales,draft.id).length,1);
    assert.match(draft.number,/00001$/);
  }finally{store.close();sql.close();rmSync(dir,{recursive:true,force:true});}
});

test("master-created drafts are assigned to the matching business team for heads to manage",()=>{
  const store=new DraftStore(":memory:");
  try {
    const quotation=store.create(admin,{kind:"SQ",payload:payload()});
    const purchase=store.create(admin,{kind:"PO",payload:payload()});
    assert.equal(quotation.teamId,"sales");
    assert.equal(purchase.teamId,"importer");
    assert.equal(store.get(actor("head_sales","head","sales"),quotation.id).id,quotation.id);
    assert.equal(store.get(actor("head_importer","head","importer"),purchase.id).id,purchase.id);
  }finally{store.close();}
});

test("warehouse is mandatory on every line before submission; incomplete drafts remain editable",()=>{
  const store=new DraftStore(":memory:");
  try {
    for(const kind of ["PO","SQ"] as const){
      const staff=kind==="PO"?importer:sales, p=payload();p.lines.push({...p.lines[0],id:"missing-warehouse",warehouse:"   "});
      const draft=store.create(staff,{kind,payload:p});
      assert.throws(()=>store.transition(staff,draft.id,{version:draft.version,action:"submit"}),/Pilih gudang Accurate.*baris 2/);
      assert.equal(store.get(staff,draft.id).status,"DRAFT");
      p.lines[1].warehouse="Utama";
      const fixed=store.update(staff,draft.id,{version:draft.version,payload:p});
      assert.equal(store.transition(staff,draft.id,{version:fixed.version,action:"submit"}).status,"SUBMITTED");
    }
  } finally {store.close();}
});
