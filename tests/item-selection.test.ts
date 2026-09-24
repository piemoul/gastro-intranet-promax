import { test } from "node:test";
import assert from "node:assert/strict";
import { itemChoices } from "../src/lib/item-selection";
import { searchItemOptions } from "../src/server/accurate/service";
import type { ItemSummary } from "../src/server/accurate/types";
const item = (id: number, brand: string, model: string, active = true): ItemSummary => ({id,no:`SKU-${id}`,name:`Barang ${id}`,brand,model,unit:"PCS",active,itemType:"INVENTORY"});

test("brand/model facets keep duplicate SKUs explicit, normalize identity, and exclude incomplete or inactive masters", () => {
  const rows = [item(1,"Acme","M1"),item(2," ACME ","m1"),item(3,"Acme","M2"),item(4,"Other","M1"),item(5,"Root","M1"),item(6,"Acme",""),item(7,"Acme","M1",false)];
  const result = itemChoices(rows,"acme"," M1 ");
  assert.deepEqual(result.items.map(x=>x.id),[1,2]);
  assert.deepEqual(result.models,["m1","M2"]);
  assert.equal(result.brands.length,2);
  assert.deepEqual(itemChoices(rows,"Other","").models,["M1"]);
  assert.deepEqual(itemChoices(rows,"","M2").brands,["Acme"]);
});

test("brand/model searches use one read-only page in the selected PT and retain pagination even if the page has no matching SKU", async t => {
  const keys = ["ACCURATE_SIGNATURE_KEY","ACCURATE_API_TOKEN_RSP","ACCURATE_HOST","INTRANET_WMS_ENV_FILE"] as const;
  const saved = keys.map(key=>process.env[key]);
  Object.assign(process.env,{ACCURATE_SIGNATURE_KEY:"fixture-key",ACCURATE_API_TOKEN_RSP:"fixture-rsp",ACCURATE_HOST:"https://fixtures.accurate.id",INTRANET_WMS_ENV_FILE:""});
  t.after(()=>keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}));
  let calls = 0;
  t.mock.method(globalThis,"fetch",async(input:URL,init:RequestInit)=>{
    calls++;
    const url=new URL(input);
    assert.equal(init.method,"GET");
    assert.equal(new Headers(init.headers).get("Authorization"),"Bearer fixture-rsp");
    assert.equal(url.pathname,"/accurate/api/item/list.do");
    assert.equal(url.searchParams.get("filter.keywords.val"),"M1");
    assert.equal(url.searchParams.get("sp.page"),"2");
    assert.equal(url.searchParams.get("sp.pageSize"),"50");
    return Response.json({s:true,d:[{id:1,no:"SKU-1",name:"Fixture",itemBrand:{name:"Other"},charField1:"M1",suspended:false}],sp:{pageCount:3}});
  });
  assert.deepEqual(await searchItemOptions(2,{search:"M1",brand:"Acme",model:"M1",page:2}),{brands:["Other"],models:[],items:[],hasMore:true});
  assert.deepEqual(await searchItemOptions(2,{search:"",brand:"",model:""}),{brands:[],models:[],items:[],hasMore:false});
  await assert.rejects(searchItemOptions(4,{search:"M1",brand:"",model:""}));
  await assert.rejects(searchItemOptions(2,{search:"M1",brand:"",model:"",page:0}));
  assert.equal(calls,1);
});
