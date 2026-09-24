import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDocumentDetail, normalizeItemDetail, normalizeCustomerDetail } from "../src/server/accurate/normalize";
const source = { id: 1, number: "SO-1", transDate: "24/09/2026", taxable: true, tax1Rate: 12, percentTaxable: 91.666667, customer: { id: 5, customerNo: "C-1", name: "Example" }, currency: { code: "IDR" }, detailItem: [{ id: 11, item: { id: 8, no: "ITEM-1", name: "Master name" }, detailName: "Frozen line description", quantity: 2, useTax1: true, itemUnit: { name: "PCS" } }] };
test("normalization preserves source line identity, original description and DPP ratio", () => {
  const result = normalizeDocumentDetail(source, "SO", 2);
  assert.equal(result.companyId, 2); assert.equal(result.lines[0].lineId, 11); assert.equal(result.lines[0].itemId, 8);
  assert.equal(result.lines[0].name, "Frozen line description"); assert.equal(result.lines[0].taxRate, 12); assert.equal(result.lines[0].taxBasePercent, 91.666667);
  assert.equal(result.lines[0].availableQuantity, null); assert.equal(result.dependencyCheck.complete, false); assert.deepEqual(result.sourceWarnings, []);
});
test("missing taxable basis and unsupported discount semantics explicitly block faithful clones", () => {
  const result = normalizeDocumentDetail({ ...source, percentTaxable: undefined, cashDiscPercent: "5 + 2", detailItem: [{ ...source.detailItem[0], itemCashDiscount: 500, itemDiscPercent: "" }], totalExpense: 200 }, "SO", 1);
  assert.equal(result.sourceWarnings.length, 4); assert.match(result.sourceWarnings.join(" "), /dasar pajak/); assert.match(result.sourceWarnings.join(" "), /bertingkat/); assert.match(result.sourceWarnings.join(" "), /nominal/); assert.match(result.sourceWarnings.join(" "), /Biaya tambahan/);
});
test("calculated nominal discount does not misclassify a supported scalar percentage", () => {
  const result = normalizeDocumentDetail({ ...source, inclusiveTax: true, cashDiscPercent: "5", cashDiscount: 100 }, "SO", 1);
  assert.deepEqual(result.sourceWarnings, []);
});
test("known process history is visible without claiming exhaustive dependency checks", () => {
  const result = normalizeDocumentDetail({ ...source, processHistory: [{ id: 8, historyType: "DO", historyNumber: "DO-8" }, { id: 9, historyType: "SI", historyNumber: "SI-9" }] }, "SO", 1);
  assert.deepEqual(result.dependencies, [{ id: 8, kind: "DO", number: "DO-8" }, { id: 9, kind: "Faktur penjualan", number: "SI-9" }]); assert.equal(result.dependencyCheck.complete, false);
});
test("serial type defaults do not imply serial management, and inactive master is preserved", () => {
  const result = normalizeItemDetail({ id: 8, no: "I-8", name: "Example", suspended: true, manageSN: false, serialNumberType: "UNIQUE", unit1: { name: "PCS" }, itemBrand: { name: "Root" }, charField1: "Model" });
  assert.equal(result.manageSerial, false); assert.equal(result.active, false); assert.equal(result.brand, ""); assert.equal(result.model, "Model");
});
test("customer term comes from live Accurate term relationship", () => {
  const result = normalizeCustomerDetail({ id: 5, customerNo: "C-5", name: "Example", term: { name: "Net 30" }, billStreet: "Example street", currency: { code: "USD" }, npwpNo: "example-tax-id" });
  assert.equal(result.paymentTerm, "Net 30"); assert.equal(result.currency, "USD"); assert.equal(result.taxNumber, "example-tax-id");
});

test("commercial line metadata and exact custom fields survive normalization", () => {
  const result = normalizeDocumentDetail({ ...source, branchId: 51, charField2: "Header custom", detailItem: [{ ...source.detailItem[0], project: { name: "Example project" }, department: { name: "Example department" }, detailNotes: "Line notes", charField7: "Line custom", numericField2: 0 }] }, "SO", 1);
  assert.equal(result.header.branchId, 51); assert.deepEqual(result.header.customFields, { charField2: "Header custom" });
  assert.equal(result.lines[0].projectName, "Example project"); assert.equal(result.lines[0].departmentName, "Example department"); assert.equal(result.lines[0].notes, "Line notes"); assert.deepEqual(result.lines[0].customFields, { charField7: "Line custom", numericField2: "0" });
});
