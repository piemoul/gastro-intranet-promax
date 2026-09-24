import assert from "node:assert/strict";
import { test } from "node:test";
import { findCustomerByNo, findItemByNo, findPartnerByNo } from "../src/server/accurate/service";

test("exact master lookups use a two-row exact filter and never fall back to catalog scans", async t => {
  const original = { key: process.env.ACCURATE_SIGNATURE_KEY, token: process.env.ACCURATE_API_TOKEN, file: process.env.INTRANET_WMS_ENV_FILE, host: process.env.ACCURATE_HOST };
  process.env.ACCURATE_SIGNATURE_KEY = "test-signature"; process.env.ACCURATE_API_TOKEN = "test-token"; process.env.ACCURATE_HOST = "https://iris.accurate.id"; process.env.INTRANET_WMS_ENV_FILE = "";
  t.after(() => { for (const [key, value] of Object.entries({ ACCURATE_SIGNATURE_KEY: original.key, ACCURATE_API_TOKEN: original.token, ACCURATE_HOST: original.host, INTRANET_WMS_ENV_FILE: original.file })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const seen: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
    const url = new URL(String(input)); seen.push(url.pathname);
    assert.equal(init.method, "GET"); assert.equal(url.searchParams.get("filter.no.op"), "EQUAL"); assert.equal(url.searchParams.get("filter.no.val"), "EXACT-1"); assert.equal(url.searchParams.get("sp.pageSize"), "2"); assert.equal(url.searchParams.has("keywords"), false);
    return Response.json({ s: true, d: [{ id: 7, no: "EXACT-1", customerNo: "EXACT-1", vendorNo: "EXACT-1", name: "Example" }] });
  });
  assert.equal((await findPartnerByNo(1, "vendor", "EXACT-1"))?.id, 7);
  assert.equal((await findPartnerByNo(1, "customer", "EXACT-1"))?.id, 7);
  assert.equal((await findItemByNo(1, "EXACT-1"))?.id, 7);
  assert.equal((await findCustomerByNo(1, "EXACT-1"))?.id, 7);
  assert.equal(await findItemByNo(1, ""), null); assert.equal(seen.length, 4);
});
