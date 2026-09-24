import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { accurateHost, accurateTimestamp, createAccurateTransport, READ_ENDPOINTS, type ReadEndpoint } from "../src/server/accurate/transport";
const config = { host: "https://iris.accurate.id", signatureKey: "test-signature", tokenForCompany: (id: number) => `test-token-${id}`, waitForSlot: async () => undefined };

test("all allowed Accurate endpoints are GET-only list/detail calls, with no redirect forwarding", async () => {
  const seen: string[] = [];
  const read = createAccurateTransport({ ...config, now: () => new Date("2026-09-24T00:01:02Z"), fetchImpl: (async (input: URL | string | Request, init?: RequestInit) => {
    const url = new URL(String(input)); seen.push(url.pathname);
    assert.equal(url.hostname, "iris.accurate.id"); assert.equal(init?.method, "GET"); assert.equal(init?.body, undefined); assert.equal(init?.redirect, "error");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-token-2");
    assert.equal(headers["X-Api-Timestamp"], "24/09/2026 07:01:02");
    assert.equal(headers["X-Api-Signature"], createHmac("sha256", "test-signature").update("24/09/2026 07:01:02").digest("base64"));
    return Response.json({ s: true, d: [] });
  }) as typeof fetch });
  for (const endpoint of READ_ENDPOINTS) await read(2, endpoint, { id: 42 });
  assert.equal(seen.length, READ_ENDPOINTS.length);
  assert.ok(seen.every(path => /^\/accurate\/api\/[a-z-]+\/(list|detail)\.do$/.test(path)));
});

test("write endpoints and invalid companies are rejected before network", async () => {
  let calls = 0;
  const read = createAccurateTransport({ ...config, fetchImpl: (async () => { calls++; return Response.json({ s: true, d: [] }); }) as typeof fetch });
  for (const path of ["item/save.do", "sales-order/close.do", "sales-order/delete.do", "../save.do", "https://evil.example/item/list.do", "item/detail.do?method=delete"]) {
    await assert.rejects(read(1, path as ReadEndpoint), /hanya pembacaan/);
  }
  for (const id of [0, 4, NaN, 1.5, -1]) await assert.rejects(read(id, "item/list.do"), /PT tidak valid/);
  assert.equal(calls, 0);
});

test("host validation prevents credential leakage to arbitrary hosts or embedded paths", () => {
  assert.equal(accurateHost("https://iris.accurate.id/"), "https://iris.accurate.id");
  for (const host of ["http://iris.accurate.id", "https://accurate.id.evil.test", "https://evil.test", "https://user@iris.accurate.id", "https://iris.accurate.id/x", "https://iris.accurate.id/?next=evil", "https://iris.accurate.id:444", "file:///etc/passwd"]) assert.throws(() => accurateHost(host));
});

test("server error bodies and transport errors never leak provider credentials or internals", async () => {
  for (const fetchImpl of [async () => Response.json({ s: false, d: ["secret-test-token-1"] }, { status: 401 }), async () => { throw new Error("secret-test-token-1"); }]) {
    const read = createAccurateTransport({ ...config, fetchImpl: fetchImpl as typeof fetch });
    await assert.rejects(read(1, "item/list.do"), error => error instanceof Error && !error.message.includes("secret") && !error.message.includes("test-token"));
  }
});

test("signed timestamps use WIB at midnight without hour 24", () => {
  assert.equal(accurateTimestamp(new Date("2026-09-23T17:00:00Z")), "24/09/2026 00:00:00");
});
