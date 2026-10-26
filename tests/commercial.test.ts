import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { CommercialStore } from "../src/server/commercial-store";
import { emptyManagedItem,defaultSettings,generatedTiers,quotedItemPrice,convertPrice } from "../src/lib/commercial";
import type { Actor } from "../src/lib/domain";
const admin:Actor={userId:"master-admin",name:"Admin",role:"master_admin",companyId:1,companyIds:[1,2,3],teamId:"all"};
const head:Actor={...admin,userId:"head",role:"head_sales",teamId:"sales"};
const sales:Actor={...head,userId:"sales",role:"sales"};
const item=()=>({...emptyManagedItem(),accurateId:32,accurateNo:"SKU32",name:"Canonical item",unit:"PCS",currency:"USD",costCurrency:"USD",buyPrices:[{id:"buy",description:"Purchase",price:100,currency:"USD"}],multipliers:[{id:"cost",description:"Landed",value:1.2}],selectedBuyPrice:"buy",selectedMultiplier:"cost",deliveryCost:5,installationCost:10,tiers:[150,170,180,190,200,210]});
test("pricebook distinguishes markup and margin, uses explicit FX and prevents unsafe rounding",()=>{
 const p=item(),rates={IDR:1,USD:15000};assert.deepEqual(generatedTiers(p,rates),[138,144,156,168,180,192]);
 assert.equal(convertPrice(100,"USD","IDR",rates),1500000);assert.throws(()=>convertPrice(10,"EUR","IDR",rates),/Kurs/);
 const q=quotedItemPrice(p,{...defaultSettings(),rates},{tier:0,currency:"IDR",branch:"Main",mode:"ALL",rounding:10000,date:"2026-10-26"});
 assert.equal(q.price,2480000);assert.equal(q.totalCost,2025000);
 assert.throws(()=>quotedItemPrice({...p,currency:"IDR",costCurrency:"IDR",tiers:[10,null,null,null,null,null]},{...defaultSettings(),rates},{tier:0,currency:"IDR",branch:"",mode:"NONE",rounding:10000,date:"2026-10-26"}),/nol/);
 assert.throws(()=>quotedItemPrice({...p,validUntil:"2026-01-01"},defaultSettings(),{tier:0,currency:"USD",branch:"",mode:"NONE",rounding:0,date:"2026-10-26"}),/masa berlaku/);
 assert.throws(()=>convertPrice(1e12,"USD","IDR",rates),/batas aman/);
});
test("commercial parameters enforce Super Admin writes, tenant isolation, versions, history and append-only audit",()=>{
 const store=new CommercialStore(":memory:");try{
  assert.throws(()=>store.save(head,"ITEM","32",0,item()),{code:"FORBIDDEN"});assert.throws(()=>store.get(sales,"ITEM","32"),{code:"FORBIDDEN"});
  const one=store.save(admin,"ITEM","32",0,item());assert.equal(one.version,1);assert.equal(store.get(head,"ITEM","32")?.version,1);
  assert.equal(store.get({...admin,companyId:2},"ITEM","32"),null);
  assert.throws(()=>store.save(admin,"ITEM","32",0,item()),{code:"VERSION_CONFLICT"});
  const two=store.save(admin,"ITEM","32",1,{...item(),tiers:[180,190,200,210,220,230]});assert.equal(two.version,2);assert.equal((store.atVersion(head,"32",1)?.data as ReturnType<typeof item>).tiers[0],150);
  assert.throws(()=>store.db.exec("DELETE FROM intranet_commercial_audit"),/append-only/);assert.throws(()=>store.db.exec("UPDATE intranet_commercial_audit SET key='tampered'"),/append-only/);
  assert.throws(()=>store.audit(sales),{code:"FORBIDDEN"});assert.equal(store.audit(head).length,2);
 }finally{store.close();}
});
test("concurrent commercial edits lose safely and an audit failure rolls the parameter back",()=>{
 const dir=mkdtempSync(path.join(tmpdir(),"intranet-commercial-")),file=path.join(dir,"commercial.sqlite");const a=new CommercialStore(file),b=new CommercialStore(file);try{
  a.save(admin,"SETTINGS","default",0,defaultSettings());b.save(admin,"SETTINGS","default",1,{...defaultSettings(),footer:"winner"});
  assert.throws(()=>a.save(admin,"SETTINGS","default",1,defaultSettings()),{code:"VERSION_CONFLICT"});
  a.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON intranet_commercial_audit BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END");
  assert.throws(()=>b.save(admin,"SETTINGS","default",2,{...defaultSettings(),footer:"loser"}),/fixture audit failure/);
  assert.equal((a.get(admin,"SETTINGS","default")?.data as ReturnType<typeof defaultSettings>).footer,"winner");assert.equal(a.get(admin,"SETTINGS","default")?.version,2);
 }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
test("followup ownership cannot be moved to another sales user or team",()=>{
 const store=new CommercialStore(":memory:");try{
  const data={ownerId:sales.userId,teamId:sales.teamId,status:"SENT",sentAt:"2026-10-26",nextContact:"",notes:"Internal"};
  store.save(sales,"FOLLOWUP","sq-own",0,data);assert.equal(store.get(head,"FOLLOWUP","sq-own")?.version,1);
  assert.throws(()=>store.get({...sales,userId:"other"},"FOLLOWUP","sq-own"),{code:"FORBIDDEN"});
  assert.throws(()=>store.save(admin,"FOLLOWUP","sq-own",1,{...data,ownerId:"other"}),{code:"FORBIDDEN"});
 }finally{store.close();}
});
