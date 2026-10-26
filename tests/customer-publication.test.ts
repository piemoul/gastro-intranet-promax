import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftStore } from "../src/server/store";
import { emptyCustomer,type Actor } from "../src/lib/domain";
import { publishCustomer,customerCreateBody } from "../src/server/publish-customer";
import { createCustomerTransport } from "../src/server/accurate/customer-create-transport";
import { AccurateCreateError } from "../src/server/accurate/create-transport";
const admin:Actor={userId:"admin",name:"Admin",role:"master_admin",companyId:1,companyIds:[1,2,3],teamId:"all"};
const head:Actor={...admin,userId:"head",role:"head_sales",teamId:"sales"};
const payload=()=>({...emptyCustomer(),no:"NEW-CLIENT",name:"Fixture client",date:"2026-10-26",email:"client@example.com",address:"Fixture address",profile:{alias:"Alias",group:"Group",category:"",branch:"",city:"Jakarta",province:"",country:"Indonesia",zipCode:"",salesperson:"",contacts:[{name:"PIC",position:"Manager",email:"pic@example.com",phone:"123"}]}});
function approved(store:DraftStore){let d=store.create(admin,{kind:"CUSTOMER_CREATE",payload:payload()});d=store.transition(admin,d.id,{version:d.version,action:"submit"});return store.transition(admin,d.id,{version:d.version,action:"approve"});}
const preflight=async()=>{};const verify=async()=>({id:800,number:"NEW-CLIENT"});
test("only Super Admin creates and publishes customers; payload never includes update IDs or opening balances",async()=>{
 const store=new DraftStore(":memory:");try{
  assert.throws(()=>store.create(head,{kind:"CUSTOMER_CREATE",payload:payload()}),{code:"FORBIDDEN"});
  const d=approved(store),body=customerCreateBody(d,"marker");assert.equal(body.transDate,"26/10/2026");assert.equal(body.detailContact[0].name,"PIC");assert.equal(Object.hasOwn(body,"id"),false);assert.equal(Object.hasOwn(body,"detailOpenBalance"),false);
  let calls=0;const result=await publishCustomer(admin,d.id,d.version,{store,preflight,verify,create:async(company,p)=>{calls++;assert.equal(company,1);assert.equal(store.get(admin,d.id).status,"PUBLISHING");assert.match(p.notes,/\[INTRANET:/);return {id:800,number:"NEW-CLIENT"};}});
  assert.equal(result.status,"PUBLISHED");assert.equal(calls,1);await assert.rejects(publishCustomer(admin,d.id,result.version,{store,preflight}));assert.equal(calls,1);
  assert.throws(()=>store.update(admin,d.id,{version:result.version,payload:payload()}),{code:"PUBLICATION_LOCKED"});
 }finally{store.close();}
});
test("customer publication freezes the exact version and blocks competing drafts with the same customer code",async()=>{
 const store=new DraftStore(":memory:");try{
  const one=approved(store),two=approved(store);store.reservePublication(admin,one.id,one.version);
  await assert.rejects(publishCustomer(admin,two.id,two.version,{store,preflight,verify,create:async()=>{throw new Error("must not send");}}),{code:"CUSTOMER_RESERVED"});
  const other=store.create(admin,{kind:"CUSTOMER_CREATE",payload:{...payload(),no:"ANOTHER"}});await assert.rejects(publishCustomer(admin,other.id,other.version,{store,preflight}),{code:"PUBLICATION_STATUS"});
 }finally{store.close();}
});
test("uncertain customer writes remain locked for read-only reconciliation",async()=>{
 const store=new DraftStore(":memory:");try{
  const d=approved(store);let calls=0;
  const result=await publishCustomer(admin,d.id,d.version,{store,preflight,create:async()=>{calls++;throw new AccurateCreateError(true,"fixture timeout");}});
  assert.equal(result.status,"UNCERTAIN");await assert.rejects(publishCustomer(admin,d.id,result.version,{store,preflight}));assert.equal(calls,1);
  const done=store.completePublication(admin,d.id,result.publication!.attemptId,{outcome:"published",id:800,number:"NEW-CLIENT"});assert.equal(done.status,"PUBLISHED");
 }finally{store.close();}
});
test("customer transport signs one JSON request and rejects IDs, unknown fields and financial balances without network",async()=>{
 const store=new DraftStore(":memory:");try{
  const body=customerCreateBody(approved(store),"marker");let calls=0;
  const send=createCustomerTransport({host:"https://fixtures.accurate.id",signatureKey:"fixture",tokenForCompany:()=>"fixture-token",fetchImpl:async(url,init)=>{calls++;assert.equal(String(url),"https://fixtures.accurate.id/accurate/api/customer/save.do");assert.equal(init?.method,"POST");assert.equal(init?.redirect,"error");const p=JSON.parse(String(init?.body));assert.equal(p.customerNo,"NEW-CLIENT");assert.equal(p.id,undefined);assert.equal(p.detailOpenBalance,undefined);return Response.json({s:true,r:{id:800,customerNo:"NEW-CLIENT"}});}});
  assert.deepEqual(await send(1,body),{id:800,number:"NEW-CLIENT"});assert.equal(calls,1);
  await assert.rejects(send(1,{...body,id:800} as unknown as typeof body));await assert.rejects(send(1,{...body,detailOpenBalance:[{amount:999}]} as unknown as typeof body));await assert.rejects(send(1,{...body,detailContact:[{...body.detailContact[0],id:1}]} as unknown as typeof body));assert.equal(calls,1);
 }finally{store.close();}
});
