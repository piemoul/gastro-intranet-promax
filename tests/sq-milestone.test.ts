import { test } from "node:test";
import assert from "node:assert/strict";
import { directoryGrants } from "../src/server/auth/portal-policy";
import { UserStore, MASTER_ADMIN_EMAIL } from "../src/server/auth/users";
import { DraftStore } from "../src/server/store";
import { assertPublish } from "../src/server/workflow";
import { emptyTransaction, type Actor, type TransactionPayload } from "../src/lib/domain";

const snapshot=(items:unknown[])=>({source:"gastro-portal-baserow",complete:true,fetchedAt:new Date().toISOString(),items});
const employee={id:"101",name:"Sales Eligible",email:"sales@example.com",company:"GGS",department:" sales & marketing ",active:true};
const admin:Actor={userId:"master-admin",name:"Admin",role:"master_admin",companyId:1,companyIds:[1,2,3],teamId:"all"};
const sales:Actor={...admin,userId:"sales",name:"Sales",role:"sales",companyIds:[1],teamId:"sales"};
const head:Actor={...sales,userId:"head",role:"head_sales"};
const details={subject:"Penawaran",pic:"PIC",validity:"",delivery:"",installation:"",warranty:"",franco:"",pricingReviewed:false};
const entry=():TransactionPayload=>({...emptyTransaction(),partnerId:17,partnerNo:"C17",partnerName:"Client",sqDetails:{...details},lines:[{id:"one",itemId:32,itemNo:"SKU32",name:"Item",unit:"PCS",quantity:2,unitPrice:0,discountPercent:0,taxPercent:0,warehouse:"",notes:"",entrySource:{kind:"wms",wmsId:"w32",brand:"Brand",model:"Model"}}]});

test("Portal eligibility uses department/PT and exact immutable Super Admin identities",()=>{
  const grants=directoryGrants(snapshot([employee,{...employee,id:"5",name:"Dondy",email:"dondy.i@gastro.co.id"},{...employee,id:"38",name:"Yogi",email:"yogi.k@gastro.co.id",company:"",department:"NPD"},{...employee,id:"30",name:"Rendy",email:"a.rendy@saranarefrigeratama.co.id",company:"SR"},{...employee,id:"202",name:"Portal Admin",email:"other@example.com",department:"HR",role:"ADMIN"},{...employee,id:"203",email:"unknown@example.com",company:"KHL"}]));
  assert.equal(grants.length,4);assert.deepEqual(grants[0].companyIds,[1]);
  assert.equal(grants.filter(g=>g.role==="master_admin").length,3);
  for(const g of grants.filter(g=>g.role==="master_admin"))assert.deepEqual(g.companyIds,[1,2,3]);
  const imposter=directoryGrants(snapshot([{...employee,id:"5",email:"imposter@example.com",name:"Dondy"}]));assert.equal(imposter[0].role,"sales");
  assert.equal(directoryGrants(snapshot([{...employee,id:"301",email:"rsp@example.com",company:"PT Resto Sarana Prima"}]))[0].companyIds[0],2);
});

test("partial, stale and duplicate Portal snapshots cannot be used for grants/revocation",()=>{
  assert.throws(()=>directoryGrants({...snapshot([employee]),complete:false}));
  assert.throws(()=>directoryGrants({...snapshot([employee]),fetchedAt:"2020-01-01T00:00:00.000Z"}));
  assert.throws(()=>directoryGrants(snapshot([employee,{...employee,id:"102",email:employee.email.toUpperCase()}])));
  assert.throws(()=>directoryGrants(snapshot([employee,{...employee,email:"second@example.com"}])));
});

test("directory changes revoke active sessions, remain audited, preserve Google binding and never adopt manual users",()=>{
  const users=new UserStore(":memory:");
  try{
    users.syncDirectory(directoryGrants(snapshot([employee])));
    const bound=users.authenticateIdentity({email:employee.email,sub:"verified-sales",emailVerified:true,authoritative:true});
    const token=users.createSession(bound);assert.ok(users.actor(token));
    const before=users.db.prepare("SELECT count(*) AS n FROM user_audit").get()!.n;
    users.syncDirectory(directoryGrants(snapshot([employee])));
    assert.equal(users.db.prepare("SELECT count(*) AS n FROM user_audit").get()!.n,before);
    assert.ok(users.actor(token));
    users.syncDirectory(directoryGrants(snapshot([{...employee,active:false}])));assert.equal(users.actor(token),null);
    assert.throws(()=>users.authenticateIdentity({email:employee.email,sub:"verified-sales",emailVerified:true,authoritative:true}));
    users.syncDirectory(directoryGrants(snapshot([employee])));
    assert.throws(()=>users.authenticateIdentity({email:employee.email,sub:"different-google",emailVerified:true,authoritative:true}));
    users.syncDirectory(directoryGrants(snapshot([{...employee,email:"reassigned@example.com"}])));
    assert.equal(users.byEmail(employee.email)?.active,false);assert.equal(users.byEmail("reassigned@example.com"),null);
    users.syncDirectory([]);assert.equal(users.byEmail(MASTER_ADMIN_EMAIL)?.active,true);
    const manual=users.save(admin,{email:"manual@example.com",name:"Manual",role:"head_sales",companyIds:[1],active:true});
    users.syncDirectory(directoryGrants(snapshot([{...employee,id:"999",email:manual.email}])));
    assert.equal(users.byEmail(manual.email)?.id,manual.id);assert.equal(users.byEmail(manual.email)?.role,"head_sales");
    assert.throws(()=>users.save(admin,{name:"Escalate",role:"head_sales",companyIds:[1],active:true},"portal:101"));
  }finally{users.close();}
});

test("server rejects forged price/tax/terms and admin-only review flags before persistence",()=>{
  const store=new DraftStore(":memory:");try{
    for(const mutate of [(p:TransactionPayload)=>p.lines[0].unitPrice=100,(p:TransactionPayload)=>p.lines[0].taxPercent=11,(p:TransactionPayload)=>p.paymentTerm="NET30",(p:TransactionPayload)=>p.sqDetails!.pricingReviewed=true]){
      const p=entry();mutate(p);assert.throws(()=>store.create(sales,{kind:"SQ",payload:p}),{code:"SQ_PRICING_ROLE"});
    }
    assert.equal(store.list(sales).length,0);
    const d=store.create(sales,{kind:"SQ",payload:entry()});const forged=entry();forged.lines[0].discountPercent=10;
    assert.throws(()=>store.update(sales,d.id,{version:1,payload:forged}),{code:"SQ_PRICING_ROLE"});assert.equal(store.get(sales,d.id).version,1);
  }finally{store.close();}
});

test("custom requests cannot be approved until mapped; every subsequent edit invalidates approval",()=>{
  const store=new DraftStore(":memory:");try{
    const p=entry();p.lines[0]={...p.lines[0],itemId:0,itemNo:"",entrySource:{kind:"custom",brand:"",model:""}};
    let d=store.create(sales,{kind:"SQ",payload:p});d=store.transition(sales,d.id,{version:1,action:"submit"});
    assert.throws(()=>store.transition(head,d.id,{version:d.version,action:"approve"}),{code:"FORBIDDEN"});
    p.sqDetails!.pricingReviewed=true;p.lines[0].unitPrice=100;p.lines[0].warehouse="Utama";
    d=store.update(head,d.id,{version:d.version,payload:p});d=store.transition(head,d.id,{version:d.version,action:"submit"});
    assert.throws(()=>store.transition(admin,d.id,{version:d.version,action:"approve"}),/Petakan barang custom/);
    p.lines[0].itemId=32;p.lines[0].itemNo="SKU32";
    d=store.update(head,d.id,{version:d.version,payload:p});d=store.transition(head,d.id,{version:d.version,action:"submit"});
    d=store.transition(admin,d.id,{version:d.version,action:"approve"});assertPublish(admin,d);
    assert.throws(()=>assertPublish(sales,d),{code:"FORBIDDEN"});assert.throws(()=>assertPublish(head,d),{code:"FORBIDDEN"});
    assert.throws(()=>assertPublish(admin,{...d,approvalPolicy:undefined}),{code:"PUBLICATION_STATUS"});
    d=store.update(head,d.id,{version:d.version,payload:{...p,description:"changed"}});
    assert.equal(d.status,"DRAFT");assert.equal(d.approvedBy,null);assert.equal(d.approvalPolicy,null);
    assert.throws(()=>assertPublish(admin,d),{code:"PUBLICATION_STATUS"});
  }finally{store.close();}
});
