import { test } from "node:test";
import assert from "node:assert/strict";
import { getWarehouses } from "../src/server/accurate/service";

test("warehouse master follows all pages, excludes inactive/unknown entries and deduplicates IDs",async t=>{
  const keys=["ACCURATE_SIGNATURE_KEY","ACCURATE_API_TOKEN_RSP","ACCURATE_HOST","INTRANET_WMS_ENV_FILE"] as const;
  const saved=keys.map(k=>process.env[k]);
  Object.assign(process.env,{ACCURATE_SIGNATURE_KEY:"fixture",ACCURATE_API_TOKEN_RSP:"fixture-rsp",ACCURATE_HOST:"https://fixtures.accurate.id",INTRANET_WMS_ENV_FILE:""});
  t.after(()=>keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];}));
  let calls=0;
  t.mock.method(globalThis,"fetch",async(input:URL,init:RequestInit)=>{
    assert.equal(init.method,"GET");assert.equal(new Headers(init.headers).get("Authorization"),"Bearer fixture-rsp");
    const url=new URL(input);assert.equal(url.pathname,"/accurate/api/warehouse/list.do");
    const page=Number(url.searchParams.get("sp.page"));assert.equal(page,++calls);
    return Response.json({s:true,d:page===1?[{id:1,name:"Active",suspended:false},{id:2,name:"Inactive",suspended:true},{id:3,name:"Unknown"}]:[{id:1,name:"Active",suspended:false},{id:4,name:"Second page",suspended:false}],sp:{pageCount:2}});
  });
  assert.deepEqual(await getWarehouses(2),[{id:1,name:"Active"},{id:4,name:"Second page"}]);assert.equal(calls,2);
});
