import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftStore } from "../src/server/store";
import { publishOrder, verifyPublishedOrder } from "../src/server/publish-order";
import { orderPayload } from "../src/server/accurate/order-payload";
import { AccurateCreateError, createOrderTransport } from "../src/server/accurate/create-transport";
import { emptyTransaction, type Actor, type Draft } from "../src/lib/domain";

const admin:Actor={userId:"admin",name:"Admin",role:"master_admin",companyId:1,companyIds:[1,2,3],teamId:"central"};
const head:Actor={...admin,userId:"head",role:"head_importer",teamId:"importer"};
const payload=()=>({...emptyTransaction(),date:"2026-09-25",partnerId:17,partnerNo:"V-17",partnerName:"Supplier",lines:[{id:"one",itemId:32,itemNo:"SKU32",name:"Item",unit:"PCS",quantity:2,unitPrice:100,discountPercent:5,taxPercent:0,taxBasePercent:100,warehouse:"Utama",notes:"Note"}]});
function approved(store:DraftStore,kind:"PO"|"SO"="PO") {
  let d=store.create(admin,{kind:kind==="SO"?"SQ":"PO",payload:payload()});
  d=store.transition(admin,d.id,{version:d.version,action:"submit"});
  d=store.transition(admin,d.id,{version:d.version,action:"approve"});
  if(kind==="SO") {
    d=store.transition(admin,d.id,{version:d.version,action:"promote"});
    d=store.transition(admin,d.id,{version:d.version,action:"submit"});
    d=store.transition(admin,d.id,{version:d.version,action:"approve"});
  }
  return d;
}
const preflight=async()=>{};
const verify=async(_draft:Draft,id:number,number:string)=>({id,number});

test("PO and SO publish once, freeze edits and keep Accurate identity in audit",async()=>{
  for(const kind of ["PO","SO"] as const) {
    const store=new DraftStore(":memory:");
    try {
      const d=approved(store,kind);let calls=0;
      const create=async(company:number,sentKind:"PO"|"SO",params:Record<string,string>)=>{
        calls++;assert.equal(company,1);assert.equal(sentKind,kind);assert.ok(params.description.includes("[INTRANET:"));
        const locked=store.get(admin,d.id);assert.equal(locked.status,"PUBLISHING");
        assert.throws(()=>store.update(admin,d.id,{version:locked.version,payload:payload()}),/dikunci/);
        return {id:80,number:`${kind}-80`};
      };
      const attempts=await Promise.allSettled([publishOrder(admin,d.id,d.version,{store,preflight,create,verify}),publishOrder(admin,d.id,d.version,{store,preflight,create,verify})]);
      assert.equal(attempts.filter(a=>a.status==="fulfilled").length,1);assert.equal(calls,1);
      const saved=store.get(admin,d.id);assert.equal(saved.status,"PUBLISHED");assert.equal(saved.publication?.accurateNumber,`${kind}-80`);
      for(const action of ["reopen","demote","revise"] as const)assert.throws(()=>store.transition(admin,d.id,{version:saved.version,action,reason:"Change"}),/dikunci/);
      await assert.rejects(publishOrder(admin,d.id,saved.version,{store,preflight,create,verify}));assert.equal(calls,1);
      assert.deepEqual(store.audit(admin,d.id).slice(0,2).map(a=>a.action),["accurate_published","accurate_reserved"]);
    } finally {store.close();}
  }
});

test("role/company/status/version/source restrictions stop all upstream writes",async()=>{
  const store=new DraftStore(":memory:");
  try {
    const d=approved(store);let calls=0;
    const dependencies={store,preflight,create:async()=>{calls++;return {id:80,number:"PO80"};},verify};
    for(const actor of [{...head,role:"importer" as const},{...head,companyId:2 as const},{...head,teamId:"other"},{...head,role:"head_sales" as const}])await assert.rejects(publishOrder(actor,d.id,d.version,dependencies));
    await assert.rejects(publishOrder(admin,d.id,d.version-1,dependencies));
    const unapproved=store.create(admin,{kind:"PO",payload:payload()});await assert.rejects(publishOrder(admin,unapproved.id,1,dependencies));
    const source=store.create(admin,{kind:"PO",payload:payload(),source:{kind:"PO",id:90,number:"existing",fingerprint:"hash"}});
    const submitted=store.transition(admin,source.id,{version:1,action:"submit"});
    const a=store.transition(admin,source.id,{version:submitted.version,action:"approve"});await assert.rejects(publishOrder(admin,a.id,a.version,dependencies));
    assert.equal(calls,0);
  } finally {store.close();}
});

test("timeouts, read-back failure and process interruptions remain locked without retries",async()=>{
  const store=new DraftStore(":memory:");
  try {
    for(const failure of ["network","verify"] as const) {
      const d=approved(store);let calls=0;
      const after=await publishOrder(head,d.id,d.version,{store,preflight,create:async()=>{calls++;if(failure==="network")throw new AccurateCreateError(true,"Timeout");return{id:80,number:"PO80"};},verify:async()=>{throw new Error("readback failed");}});
      assert.equal(after.status,"UNCERTAIN");assert.equal(calls,1);
      await assert.rejects(publishOrder(head,d.id,after.version,{store,preflight}));
      assert.throws(()=>store.update(admin,d.id,{version:after.version,payload:payload()}),/dikunci/);
      const recovered=store.completePublication(head,d.id,after.publication!.attemptId,{outcome:"published",id:80,number:"PO80"});
      assert.equal(store.completePublication(head,d.id,after.publication!.attemptId,{outcome:"uncertain",error:"Late timeout"}).status,"PUBLISHED");assert.equal(recovered.status,"PUBLISHED");
    }
    const d=approved(store),reserved=store.reservePublication(head,d.id,d.version);
    await assert.rejects(publishOrder(head,d.id,reserved.version,{store,preflight}));
    assert.throws(()=>store.completePublication(head,d.id,"wrong-attempt",{outcome:"published",id:80,number:"PO80"}));
  } finally {store.close();}
});

test("definitive rejection permits a new deliberate attempt and preflight failure reserves nothing",async()=>{
  const store=new DraftStore(":memory:");
  try {
    const d=approved(store);
    await assert.rejects(publishOrder(head,d.id,d.version,{store,preflight:async()=>{throw new Error("Master changed");}}));
    assert.equal(store.get(head,d.id).version,d.version);
    const rejected=await publishOrder(head,d.id,d.version,{store,preflight,create:async()=>{throw new AccurateCreateError(false,"Denied");}});
    assert.equal(rejected.status,"APPROVED");
    const success=await publishOrder(head,d.id,rejected.version,{store,preflight,create:async()=>({id:80,number:"PO80"}),verify});
    assert.equal(success.status,"PUBLISHED");assert.notEqual(success.publication?.attemptId,rejected.publication?.attemptId);
  } finally {store.close();}
});

test("mapping preserves commercial fields, rejects unsupported data and cannot inject IDs",()=>{
  const store=new DraftStore(":memory:");
  try {
    const d=approved(store);const p=payload();d.payload={...p,currency:"USD",exchangeRate:15000,branch:"Main",paymentTerm:"NET30",shipDate:"2026-10-02",reference:"Supplier quote",description:"Description",discountPercent:2};
    const mapped=orderPayload(d,"marker");
    assert.equal(mapped.vendorNo,p.partnerNo);assert.equal(mapped.transDate,"25/09/2026");assert.equal(mapped.shipDate,"02/10/2026");assert.equal(mapped.rate,"15000");assert.equal(mapped["detailItem[0].unitPrice"],"100");assert.equal(mapped["detailItem[0].itemDiscPercent"],"5");assert.equal(mapped["detailItem[0].useTax2"],"false");assert.equal(mapped.cashDiscPercent,"2");assert.equal(mapped["detailItem[0].warehouseName"],"Utama");assert.equal(mapped.number,undefined);assert.equal(mapped.id,undefined);assert.match(mapped.description,/Referensi: Supplier quote/);
    d.payload={...p,customFields:{id:"999"}};assert.throws(()=>orderPayload(d,"marker"),/Field tambahan/);
    d.payload={...p,lines:[{...p.lines[0],taxPercent:12,taxBasePercent:91.666667}]};assert.throws(()=>orderPayload(d,"marker"),/DPP/);
    d.payload={...p,lines:[{...p.lines[0],sourceLineId:44}]};assert.throws(()=>orderPayload(d,"marker"),/diterbitkan ulang/);
  } finally {store.close();}
});

test("dedicated create transport posts signed form data once and does not follow redirects or expose secrets",async()=>{
  let calls=0;
  const config={host:"https://iris.accurate.id",signatureKey:"test-secret",tokenForCompany:()=>"test-token"};
  const create=createOrderTransport({...config,fetchImpl:async(url,init)=>{calls++;assert.match(String(url),/purchase-order\/save.do$/);assert.equal(init?.method,"POST");assert.equal(init?.redirect,"error");assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer test-token");assert.equal(new URLSearchParams(String(init?.body)).get("detailItem[0].itemNo"),"SKU&32");return Response.json({s:true,r:{id:80,number:"PO80"}});}});
  assert.deepEqual(await create(2,"PO",{"detailItem[0].itemNo":"SKU&32"}),{id:80,number:"PO80"});
  const invalid:Record<string,string>[]=[{id:"80"},{"detailItem[0].id":"90"},{number:"existing"},{"detailItem[0]._status":"delete"}];
  for(const params of invalid)await assert.rejects(create(1,"PO",params));
  assert.equal(calls,1);
  for(const response of [new Response("bad",{status:502}),Response.json({s:true,d:["Success"]})]) {
    let count=0;const send=createOrderTransport({...config,fetchImpl:async()=>{count++;return response;}});
    await assert.rejects(send(1,"SO",{}),e=>e instanceof AccurateCreateError&&e.uncertain);assert.equal(count,1);
  }
  const fail=createOrderTransport({...config,fetchImpl:async()=>{throw new Error("test-token test-secret");}});
  await assert.rejects(fail(1,"SO",{}),e=>e instanceof AccurateCreateError&&e.uncertain&&!e.message.includes("test-"));
  const denied=createOrderTransport({...config,fetchImpl:async()=>Response.json({s:false,d:["No access"]},{status:403})});
  await assert.rejects(denied(1,"SO",{}),e=>e instanceof AccurateCreateError&&!e.uncertain);
});

test("read-back requires the correct reservation marker, partner, item and amount",async()=>{
  const store=new DraftStore(":memory:"),original=globalThis.fetch;
  const old={...process.env};
  try {
    process.env.ACCURATE_SIGNATURE_KEY="test";process.env.ACCURATE_API_TOKEN="test";
    const d=approved(store),reserved=store.reservePublication(head,d.id,d.version);
    const body={id:80,number:"PO80",transDate:"25/09/2026",vendor:{id:17,vendorNo:"V-17"},currency:{code:"IDR"},rate:1,inclusiveTax:false,cashDiscPercent:"0",description:reserved.publication!.marker,totalAmount:190,detailItem:[{item:{id:32,no:"SKU32"},itemUnit:{name:"PCS"},warehouse:{name:"Utama"},quantity:2,unitPrice:100,itemDiscPercent:"5"}]};
    globalThis.fetch=async(_url,init)=>{assert.equal(init?.method,"GET");return Response.json({s:true,d:body});};
    assert.deepEqual(await verifyPublishedOrder(reserved,80,"PO80"),{id:80,number:"PO80"});
    body.detailItem[0].warehouse.name="Wrong";await assert.rejects(verifyPublishedOrder(reserved,80,"PO80"));body.detailItem[0].warehouse.name="Utama";
    body.description="other draft";await assert.rejects(verifyPublishedOrder(reserved,80,"PO80"));
    body.description=reserved.publication!.marker;body.totalAmount=210;await assert.rejects(verifyPublishedOrder(reserved,80,"PO80"));
  } finally {globalThis.fetch=original;for(const key of ["ACCURATE_SIGNATURE_KEY","ACCURATE_API_TOKEN"])if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];store.close();}
});
