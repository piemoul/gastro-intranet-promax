import "next/dist/server/node-environment-baseline";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { createRequestStoreForAPI } from "next/dist/server/async-storage/request-store";
import { workAsyncStorage, type WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { emptyCustomer, emptyTransaction, type Draft, type Role, type TransactionPayload } from "../src/lib/domain";

test("authenticated API integration uses isolated databases and allowlisted read-only fixtures", async context => {
  const originalFetch=globalThis.fetch;
  const envKeys=["DATABASE_URL","INTRANET_DATA_DIR","INTRANET_WMS_ENV_FILE","APP_URL","INTRANET_WMS_API_URL","INTRANET_WMS_API_KEY","INTRANET_PORTAL_API_URL","ACCURATE_HOST","ACCURATE_SIGNATURE_KEY","ACCURATE_API_TOKEN","ACCURATE_API_TOKEN_RSP","ACCURATE_API_TOKEN_SARANA"] as const;
  const savedEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
  const dir=mkdtempSync(join(tmpdir(),"intranet-api-"));
  Object.assign(process.env,{DATABASE_URL:"",INTRANET_PORTAL_API_URL:"",INTRANET_WMS_API_URL:"http://localhost:3110/v1/catalog",INTRANET_WMS_API_KEY:"fixture-wms-reference-key-32-chars",INTRANET_DATA_DIR:dir,INTRANET_WMS_ENV_FILE:"",APP_URL:"http://localhost:3100",ACCURATE_HOST:"https://fixtures.accurate.id",ACCURATE_SIGNATURE_KEY:"local-fixture-signature",ACCURATE_API_TOKEN:"fixture-company-1",ACCURATE_API_TOKEN_RSP:"fixture-company-2",ACCURATE_API_TOKEN_SARANA:"fixture-company-3"});
  const reads:{path:string;method:string;company:number}[]=[];
  const item={id:32,no:"SKU-32",name:"Fixture Refrigerator",itemBrand:{name:"Fixture Brand"},charField1:"Model 32",itemType:"INVENTORY",unit1:{name:"PCS"},unit2:{name:"BOX"},ratio2:2,suspended:false,unitPrice:100};
  const customer={id:17,customerNo:"C-017",name:"Fixture Customer",email:"customer@example.com",currency:{code:"IDR"},suspended:false};
  const order={id:80,number:"SO-080",transDate:"24/09/2026",customer,currency:{code:"IDR"},rate:1,taxable:true,inclusiveTax:false,percentTaxable:100,tax1Rate:11,detailItem:[{id:90,item,itemUnit:{name:"PCS"},quantity:2,unitPrice:100,useTax1:true,itemDiscPercent:0,totalPrice:200}],totalAmount:222};
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(url.origin==="http://localhost:3110"){assert.equal(Number(url.searchParams.get("companyId")),1);return Response.json({companyId:1,brands:["Fixture Brand"],models:["Model 32"],page:1,hasMore:false,fetchedAt:new Date().toISOString(),items:[{id:"wms-32",code:item.no,name:item.name,brand:"Fixture Brand",model:"Model 32",unit:"PCS",classification:"unique",stock:[],available:0}]});}
    assert.equal(url.origin,"https://fixtures.accurate.id","Only the local Accurate fixture transport may be requested.");
    const method=init?.method||"GET";
    assert.equal(method,"GET","No Accurate mutation is permitted in API tests.");
    const token=new Headers(init?.headers).get("Authorization")||"";
    assert.match(token,/^Bearer fixture-company-[123]$/);
    reads.push({path:url.pathname,method,company:Number(token.at(-1))});
    const path=url.pathname.replace("/accurate/api/","");
    let data:unknown;
    if(path==="warehouse/list.do")data=[{id:1,name:"Utama",suspended:false},{id:2,name:"Nonaktif",suspended:true}];
    else if(path==="item/detail.do")data=item;
    else if(path==="customer/detail.do")data=customer;
    else if(path==="sales-order/detail.do")data=order;
    else if(path==="sales-quotation/detail.do")data={...order,id:Number(url.searchParams.get("id")),number:url.searchParams.get("id")==="179"?"SQ179":"SQ079",taxable:false,tax1Rate:0,totalAmount:200,detailItem:[{...order.detailItem[0],useTax1:false}]};
    else if(path==="item/list.do")data=url.searchParams.get("filter.no.val")&&url.searchParams.get("filter.no.val")!==item.no?[]:[item];
    else if(path==="customer/list.do")data=url.searchParams.get("filter.no.val")&&url.searchParams.get("filter.no.val")!==customer.customerNo?[]:[customer];
    else if(path==="sales-order/list.do")data=[order];
    else throw new Error(`Unexpected Accurate endpoint blocked by fixture: ${path}`);
    return Response.json({s:true,d:data,sp:{page:1,pageCount:1,rowCount:Array.isArray(data)?data.length:1}});
  };
  const {getUsers,MASTER_ADMIN_EMAIL,SESSION_COOKIE}=await import("../src/server/auth/users");
  const {getStore}=await import("../src/server/store");
  const route=await import("../src/app/api/[...path]/route");
  const users=getUsers(),store=getStore();
  const adminToken=await users.createSession(await users.authenticateIdentity({email:MASTER_ADMIN_EMAIL,sub:"master-fixture",emailVerified:true,authoritative:true}));
  const admin=(await users.actor(adminToken))!;
  const tokens:Record<string,string>={master_admin:adminToken};
  for(const role of ["sales","head_sales","importer","head_importer"] as Role[]) {
    const user=await users.save(admin,{email:`${role}@fixture.example`,name:`Fixture ${role}`,role,companyIds:[1],active:true});
    tokens[role]=await users.createSession(await users.authenticateIdentity({email:user.email,sub:`fixture-${role}`,emailVerified:true,authoritative:true}));
  }
  const otherSales=await users.save(admin,{email:"other-sales@fixture.example",name:"Other Sales",role:"sales",companyIds:[1],active:true});
  tokens.other_sales=await users.createSession(await users.authenticateIdentity({email:otherSales.email,sub:"fixture-other-sales",emailVerified:true,authoritative:true}));
  async function request(method:"GET"|"POST"|"PUT",path:string,token?:string,input?:unknown,origin:string|null="http://localhost:3100") {
    const headers=new Headers();
    if(token)headers.set("Cookie",`${SESSION_COOKIE}=${token}`);
    if(method!=="GET")headers.set("Content-Type","application/json");
    if(origin!==null)headers.set("Origin",origin);
    const req=new NextRequest(`http://localhost:3100/api/${path}`,{method,headers,...(method!=="GET"?{body:JSON.stringify(input??{})}:{})});
    const requestStore=createRequestStoreForAPI(req,req.nextUrl,{tags:[],expirationsByCacheKind:new Map()},undefined,undefined,undefined);
    const workStore={isStaticGeneration:false,page:"/api/[...path]/route",route:"/api/[...path]"} as WorkStore;
    return workAsyncStorage.run(workStore,()=>workUnitAsyncStorage.run(requestStore,()=>route[method](req,{params:Promise.resolve({path:req.nextUrl.pathname.slice("/api/".length).split("/")})})));
  }
  const transaction=():TransactionPayload=>({...emptyTransaction(),date:"2026-09-24",partnerId:17,partnerNo:"C-017",partnerName:"untrusted browser label",lines:[{id:"local-line",itemId:32,itemNo:"SKU-32",name:"Fixture Refrigerator",unit:"PCS",quantity:2,unitPrice:0,discountPercent:0,taxPercent:0,warehouse:"",notes:"",entrySource:{kind:"wms",wmsId:"wms-32",brand:"Fixture Brand",model:"Model 32"}}]});
  let ownDraft:Draft;
  try {
    await context.test("unauthenticated calls reject and CSRF checks run before mutations or network",async()=>{
      assert.equal((await request("GET","drafts")).status,401);
      assert.equal((await request("POST","drafts",undefined,{kind:"SQ",payload:emptyTransaction()})).status,401);
      const before=reads.length;
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:emptyTransaction()},null)).status,403);
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:emptyTransaction()},"https://evil.example")).status,403);
      assert.equal((await request("PUT","users/master-admin",tokens.master_admin,{},"https://evil.example")).status,403);
      assert.equal(reads.length,before);
      assert.equal((await store.list(admin)).length,0);
    });

    await context.test("brand/model picker requires login and uses the actor PT rather than query parameters",async()=>{
      const before=reads.length;
      assert.equal((await request("GET","accurate/item-options?search=Fixture")).status,401);
      assert.equal(reads.length,before);
      const response=await request("GET","accurate/item-options?search=Fixture&brand=Fixture%20Brand&model=Model%2032&companyId=3",tokens.sales);
      assert.equal(response.status,200);
      const result=await response.json();
      assert.equal(result.items[0].id,32);
      assert.deepEqual(result.models,["Model 32"]);
      assert.equal(reads.at(-1)?.company,1);
    });

    await context.test("warehouse list is authenticated, scoped to the session company and excludes inactive rows",async()=>{
      const before=reads.length;
      assert.equal((await request("GET","accurate/warehouses")).status,401);assert.equal(reads.length,before);
      const response=await request("GET","accurate/warehouses?companyId=3",tokens.importer);
      assert.equal(response.status,200);assert.deepEqual((await response.json()).items,[{id:1,name:"Utama"}]);assert.equal(reads.at(-1)?.company,1);
      const invalid=transaction();invalid.lines[0].warehouse="Nonaktif";
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:invalid})).status,409);
      invalid.lines[0].warehouse="Foreign PT warehouse";
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:invalid})).status,409);
    });

    await context.test("staff can own local drafts but cannot read live transaction documents or other staff drafts",async()=>{
      const before=reads.length;
      for(const kind of ["PO","SQ","SO"]) {
        assert.equal((await request("GET",`accurate/documents?kind=${kind}`,tokens.sales)).status,403);
        assert.equal((await request("GET",`accurate/documents/${kind}/80`,tokens.importer)).status,403);
      }
      assert.equal(reads.length,before);
      const created=await request("POST","drafts",tokens.sales,{kind:"SQ",payload:emptyTransaction(),requestId:"local-empty-sq"});
      assert.equal(created.status,201);
      ownDraft=(await created.json()).draft;
      assert.equal(ownDraft.ownerId,(await users.actor(tokens.sales))?.userId);
      assert.equal((await request("GET",`drafts/${ownDraft.id}`,tokens.sales)).status,200);
      assert.equal((await request("GET",`drafts/${ownDraft.id}`,tokens.head_sales)).status,200);
      assert.equal((await request("GET",`drafts/${ownDraft.id}`,tokens.other_sales)).status,403);
      assert.equal((await request("GET",`drafts/${ownDraft.id}`,tokens.importer)).status,403);
      assert.deepEqual((await (await request("GET","drafts",tokens.other_sales)).json()).items,[]);
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"PO",payload:emptyTransaction()})).status,403);
      assert.equal((await request("POST","drafts",tokens.importer,{kind:"SQ",payload:emptyTransaction()})).status,403);
    });

    await context.test("users API is master-only and hides Google subject identifiers",async()=>{
      assert.equal((await request("GET","users",tokens.sales)).status,403);
      assert.equal((await request("POST","users",tokens.head_sales,{email:"new@fixture.example",name:"New User",role:"sales",companyIds:[1]})).status,403);
      assert.equal((await request("PUT",`users/${otherSales.id}`,tokens.sales,{name:"Changed User",role:"head_sales",companyIds:[1],active:true})).status,403);
      const list=await request("GET","users",adminToken);
      assert.equal(list.status,200);
      for(const user of (await list.json()).items)assert.equal(Object.hasOwn(user,"googleSub"),false);
      assert.equal((await request("POST","users",adminToken,{email:"escalate@fixture.example",name:"Escalation",role:"master_admin",companyIds:[1]})).status,400);
      assert.equal((await request("PUT","users/master-admin",adminToken,{name:"Disable Master",role:"sales",companyIds:[1],active:false})).status,403);
      const added=await request("POST","users",adminToken,{email:"api-added@fixture.example",name:"API Added",role:"importer",companyIds:[2],active:true});
      assert.equal(added.status,201);
      assert.equal((await added.json()).user.role,"importer");
    });

    await context.test("malicious company, owner, status and source body fields are rejected before external reads",async()=>{
      const before=reads.length;
      for(const extra of [{companyId:2},{ownerId:"master-admin"},{role:"master_admin"},{status:"APPROVED"},{source:{kind:"SQ",id:77,fingerprint:"forged"}}]) {
        assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:emptyTransaction(),...extra})).status,400);
      }
      assert.equal((await request("PUT",`drafts/${ownDraft.id}`,tokens.sales,{version:1,payload:emptyTransaction(),companyId:2})).status,400);
      assert.equal((await request("POST",`drafts/${ownDraft.id}/action`,tokens.sales,{version:1,action:"submit",approvedBy:"master-admin"})).status,400);
      assert.equal((await request("POST","session/company",tokens.sales,{companyId:2})).status,403);
      assert.equal(reads.length,before);
      const listing=await request("GET","accurate/items?companyId=3",tokens.sales);
      assert.equal(listing.status,200);
      assert.equal(reads.at(-1)?.company,1);
      assert.equal((await request("POST","session/company",adminToken,{companyId:2})).status,200);
      assert.equal((await request("GET",`drafts/${ownDraft.id}`,adminToken)).status,403);
      assert.equal((await request("POST","session/company",adminToken,{companyId:1})).status,200);
    });

    await context.test("master and sales head can create customer proposals; other roles cannot",async()=>{
      const payload={...emptyCustomer(),no:"NEW-CLIENT",name:"New Customer"};
      const before=reads.length;
      for(const role of ["sales","importer","head_importer"]) {
        assert.equal((await request("POST","drafts",tokens[role],{kind:"CUSTOMER_CREATE",payload})).status,403);
        assert.equal((await request("GET","accurate/customers",tokens[role])).status,403);
      }
      assert.equal(reads.length,before);
      assert.equal((await request("POST","drafts",tokens.head_sales,{kind:"CUSTOMER_CREATE",payload,requestId:"sales-head-client"})).status,201);
      assert.equal((await request("POST","drafts",adminToken,{kind:"CUSTOMER_CREATE",payload,requestId:"master-client"})).status,201);
      assert.equal((await request("GET","accurate/customers",adminToken)).status,200);
    });

    await context.test("transaction create retries are idempotent, references are revalidated and updates enforce ownership and versions",async()=>{
      const input={kind:"SQ",payload:transaction(),requestId:"verified-create"};
      const created=await request("POST","drafts",tokens.sales,input);
      assert.equal(created.status,201);
      const draft=(await created.json()).draft as Draft;
      assert.equal(draft.payload.type==="transaction"&&draft.payload.partnerName,"Fixture Customer");
      const retry=await request("POST","drafts",tokens.sales,input);
      assert.equal(retry.status,201); assert.equal((await retry.json()).draft.id,draft.id);
      assert.equal((await store.audit(admin,draft.id)).length,1);
      assert.equal((await request("POST","drafts",tokens.sales,{...input,payload:{...input.payload,description:"different"}})).status,409);
      const before=reads.length;
      assert.equal((await request("PUT",`drafts/${draft.id}`,tokens.other_sales,{version:1,payload:transaction()})).status,403);
      assert.equal(reads.length,before);
      const updated=await request("PUT",`drafts/${draft.id}`,tokens.sales,{version:1,payload:{...transaction(),description:"local change"}});
      assert.equal(updated.status,200); assert.equal((await updated.json()).draft.version,2);
      assert.equal((await request("PUT",`drafts/${draft.id}`,tokens.sales,{version:1,payload:transaction()})).status,409);
      const invalid=transaction(); invalid.lines[0].itemNo="FORGED-CODE";
      assert.equal((await request("POST","drafts",tokens.sales,{kind:"SQ",payload:invalid})).status,409);
    });

    await context.test("Accurate-source SO retries remain stable and reversal is blocked for every role",async()=>{
      const input={kind:"SO",id:80,requestId:"source-so-once"};
      const created=await request("POST","drafts/from-accurate",tokens.head_sales,input);
      assert.equal(created.status,201);
      const draft=(await created.json()).draft as Draft;
      assert.equal(draft.source?.kind,"SO");
      const retry=await request("POST","drafts/from-accurate",tokens.head_sales,input);
      assert.equal(retry.status,201); assert.equal((await retry.json()).draft.id,draft.id);
      const before=reads.length;
      for(const role of ["sales","head_sales","importer","head_importer","master_admin"]) {
        const response=await request("POST",`drafts/${draft.id}/action`,tokens[role],{version:1,action:"demote",reason:"Local regression test"});
        assert.equal(response.status,["head_sales","master_admin"].includes(role)?409:403);
      }
      assert.equal(reads.length,before);
      assert.equal((await store.get(admin,draft.id)).version,1);
      assert.equal((await store.audit(admin,draft.id)).length,1);
    });

    await context.test("all attempted Accurate write routes return 405 without sending an upstream request",async()=>{
      const before=reads.length;
      for(const method of ["POST","PUT"] as const)for(const path of ["accurate/items","accurate/customers/17","accurate/documents/SO/80","accurate/sales-order/save.do","accurate/purchase-order/delete.do"]) {
        assert.equal((await request(method,path,adminToken,{id:80})).status,405);
      }
      assert.equal(reads.length,before);
      assert.ok(reads.length>0);
      assert.ok(reads.every(read=>read.method==="GET"&&/\/(?:list|detail)\.do$/.test(read.path)));
    });

    await context.test("only sales heads select Accurate SQ; SO notes persist with provenance and duplicate protection",async()=>{
      const input={id:179,requestId:"select-quotation-fixture"};
      const before=reads.length;
      for(const role of ["sales","importer","head_importer"])assert.equal((await request("POST","drafts/select-quotation",tokens[role],input)).status,403);
      assert.equal(reads.length,before);
      const response=await request("POST","drafts/select-quotation",tokens.head_sales,input);
      assert.equal(response.status,201);
      const selected=(await response.json()).draft as Draft;
      assert.equal(selected.kind,"SO");assert.equal(selected.status,"DRAFT");
      assert.deepEqual(selected.quotation,{id:179,number:"SQ179"});assert.equal(selected.source,null);
      assert.ok(selected.payload.type==="transaction");
      assert.equal(selected.payload.lines[0].sourceLineId,undefined);
      const p={...selected.payload,internalNotes:"INTERNAL only: confirm installation",lines:selected.payload.lines.map(l=>({...l,warehouse:"Utama"}))};
      const saved=await request("PUT",`drafts/${selected.id}`,tokens.head_sales,{version:1,payload:p});assert.equal(saved.status,200);
      const reloaded=await request("GET",`drafts/${selected.id}`,tokens.head_sales);
      const result=await reloaded.json();assert.equal(result.draft.payload.internalNotes,p.internalNotes);assert.equal(result.audit[0].action,"update");
      assert.equal((await request("PUT",`drafts/${selected.id}`,tokens.head_sales,{version:1,payload:p})).status,409);
      const duplicate=await request("POST","drafts/select-quotation",tokens.head_sales,{...input,requestId:"alias"});assert.equal(duplicate.status,409);
      const {validateOrderQuotation}=await import("../src/server/quotation");
      await validateOrderQuotation(admin,result.draft);
      await assert.rejects(validateOrderQuotation(admin,{...result.draft,payload:{...p,partnerId:999}}));
      await assert.rejects(validateOrderQuotation(admin,{...result.draft,payload:{...p,lines:p.lines.map(l=>({...l,quantity:999}))}}));
    });

    await context.test("final publish API requires confirmation, head access, CSRF and the approved version",async()=>{
      const p=transaction();p.lines[0].taxPercent=0;p.lines[0].unitPrice=100;p.lines[0].warehouse="Utama";p.sqDetails={subject:"",pic:"",validity:"",delivery:"",installation:"",warranty:"",franco:"",pricingReviewed:true};
      let d=await store.create(admin,{kind:"SQ",payload:p});
      d=await store.transition(admin,d.id,{version:d.version,action:"submit"});
      d=await store.transition(admin,d.id,{version:d.version,action:"approve"});
      d=await store.reservePublication(admin,d.id,d.version);
      d=await store.completePublication(admin,d.id,d.publication!.attemptId,{outcome:"published",id:79,number:"SQ079"});
      for(const action of ["promote","submit","approve"] as const)d=await store.transition(admin,d.id,{version:d.version,action});
      const endpoint=`drafts/${d.id}/publish`,input={version:d.version,confirmed:true};
      const before=reads.length;
      assert.equal((await request("POST",endpoint,undefined,input)).status,401);
      assert.equal((await request("POST",endpoint,tokens.master_admin,input,"https://evil.example")).status,403);
      assert.equal((await request("POST",endpoint,tokens.sales,input)).status,403);
      assert.equal((await request("POST",endpoint,tokens.head_importer,input)).status,403);
      assert.equal((await request("POST",endpoint,tokens.master_admin,{...input,confirmed:false})).status,400);
      assert.equal((await request("POST",endpoint,tokens.master_admin,{...input,companyId:2})).status,400);
      assert.equal(reads.length,before);
      const previous=globalThis.fetch;let writes=0,description="";
      globalThis.fetch=async(url,init)=>{
        if(init?.method==="POST") {
          assert.match(String(url),/sales-order\/save.do$/);writes++;
          const params=new URLSearchParams(String(init.body));description=params.get("description")!;
          assert.equal(params.get("detailItem[0].warehouseName"),"Utama");assert.equal(params.get("customerNo"),customer.customerNo);assert.equal(params.has("id"),false);
          return Response.json({s:true,r:{id:81,number:"SO081"}});
        }
        if(String(url).includes("sales-order/detail.do?id=81"))return Response.json({s:true,d:{...order,id:81,number:"SO081",description,taxable:false,tax1Rate:0,totalAmount:200,detailItem:[{...order.detailItem[0],warehouse:{name:"Utama"},useTax1:false}]}});
        return previous(url,init);
      };
      try {
        const response=await request("POST",endpoint,tokens.master_admin,input);assert.equal(response.status,200);
        const published=(await response.json()).draft as Draft;assert.equal(published.status,"PUBLISHED");assert.equal(published.publication?.accurateNumber,"SO081");assert.equal(writes,1);
        assert.equal((await request("POST",endpoint,tokens.master_admin,{...input,version:published.version})).status,409);assert.equal(writes,1);
        assert.equal((await request("PUT",`drafts/${d.id}`,tokens.master_admin,{version:published.version,payload:p})).status,409);
      } finally {globalThis.fetch=previous;}
    });

    await context.test("API account changes revoke old sessions immediately and logout removes access",async()=>{
      const edited=await request("PUT",`users/${otherSales.id}`,adminToken,{name:"Disabled User",role:"sales",companyIds:[1],active:false});
      assert.equal(edited.status,200);
      assert.equal((await request("GET","drafts",tokens.other_sales)).status,401);
      assert.equal((await request("POST","auth/logout",tokens.sales,{})).status,200);
      assert.equal((await request("GET","drafts",tokens.sales)).status,401);
    });
  }finally{
    globalThis.fetch=originalFetch;
    await users.close(); await store.close();
    for(const key of envKeys)if(savedEnv[key]===undefined)delete process.env[key];else process.env[key]=savedEnv[key];
    rmSync(dir,{recursive:true,force:true});
  }
});
