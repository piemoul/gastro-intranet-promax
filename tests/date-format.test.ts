import assert from "node:assert/strict";
import test from "node:test";
import { formatDocumentDate } from "../src/lib/date-format";

test("Accurate dates use day/month order, including ambiguous dates", () => {
  assert.equal(formatDocumentDate("06/08/2026"), "6 Agu 2026");
  assert.equal(formatDocumentDate("24/09/2026"), "24 Sep 2026");
  assert.equal(formatDocumentDate("2/3/2026"), "2 Mar 2026");
});

test("ISO timestamps are displayed in Jakarta, independent of server timezone", () => {
  assert.equal(formatDocumentDate("2026-09-24T18:00:00Z"), "25 Sep 2026");
  assert.equal(formatDocumentDate("2026-09-24"), "24 Sep 2026");
});

test("Missing and invalid source dates are not silently fabricated", () => {
  assert.equal(formatDocumentDate(""), "—");
  assert.equal(formatDocumentDate("not a date"), "not a date");
  assert.equal(formatDocumentDate("31/02/2026"), "31/02/2026");
});
