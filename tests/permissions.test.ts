import { test } from "node:test";
import assert from "node:assert/strict";
import {
  can,
  effectiveScopes,
  matchingRules,
  widestScope,
  type Actor,
  type Rule,
} from "../src/lib/permissions";

/**
 * A representative subset of the real /roles matrix (verified on the live system).
 * Sourced from the DEPT SALES section + a DEPT ALL example.
 */
const RULES: Rule[] = [
  // DEPT SALES
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Customer", action: "cru", scope: "SELF", sourceField: "id", destField: "default_sales_id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Quotation", action: "cru", scope: "SELF", sourceField: "id", destField: "sales_id" },
  { department: "SALES", levelMin: "MANAGER", levelMax: "CHIEF", model: "Customer", action: "cru", scope: "BRANCH", sourceField: "id", destField: "id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Item", action: "index", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Item", action: "create", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "SENIOR MANAGER", levelMax: "CHIEF", model: "Customer", action: "crud", scope: "BRANCH", sourceField: "id", destField: "id" },
  { department: "SALES", levelMin: "STAFF", levelMax: "CHIEF", model: "Customer", action: "index", scope: "ALL", sourceField: null, destField: null },
  { department: "SALES", levelMin: "MANAGER", levelMax: "CHIEF", model: "Quotation", action: "cru", scope: "ALL", sourceField: null, destField: null },
  // DEPT ALL (applies to every department)
  { department: "ALL", levelMin: "STAFF", levelMax: "CHIEF", model: "User", action: "edit", scope: "SELF", sourceField: "id", destField: "id" },
];

const staff: Actor = { id: 10, department: "SALES", level: "STAFF", branchId: 1 };
const manager: Actor = { id: 20, department: "SALES", level: "MANAGER", branchId: 1 };
const chief: Actor = { id: 1, department: "SALES", level: "CHIEF", branchId: 1 }; // Yogi
const faStaff: Actor = { id: 30, department: "FA", level: "STAFF", branchId: 2 };

test("SALES STAFF sees only their own quotations (SELF)", () => {
  assert.equal(widestScope(RULES, staff, "Quotation", "index"), "SELF");
  const scopes = effectiveScopes(RULES, staff, "Quotation", "index");
  assert.deepEqual(scopes, [{ kind: "SELF", sourceField: "id", destField: "sales_id" }]);
});

test("SALES MANAGER sees ALL quotations (MANAGER..CHIEF ALL rule wins)", () => {
  assert.equal(widestScope(RULES, manager, "Quotation", "index"), "ALL");
});

test("SALES CHIEF (Yogi) sees ALL quotations — matches both SELF and ALL, ALL dominates", () => {
  const matched = matchingRules(RULES, chief, "Quotation", "index");
  assert.ok(matched.length >= 2, "chief should match both the STAFF-range SELF and MANAGER-range ALL rules");
  assert.deepEqual(effectiveScopes(RULES, chief, "Quotation", "index"), [{ kind: "ALL" }]);
});

test("SALES STAFF customer visibility is SELF via default_sales_id", () => {
  // index is ALL (Customer::index ALL), but cru is SELF — check the write scope.
  assert.deepEqual(effectiveScopes(RULES, staff, "Customer", "update"), [
    { kind: "SELF", sourceField: "id", destField: "default_sales_id" },
  ]);
});

test("SALES SENIOR MANAGER gets BRANCH + SELF union on customer update", () => {
  const senior: Actor = { id: 40, department: "SALES", level: "SENIOR MANAGER", branchId: 1 };
  const scopes = effectiveScopes(RULES, senior, "Customer", "update");
  // SELF (STAFF..CHIEF) + BRANCH (MANAGER..CHIEF cru) + BRANCH (SENIOR..CHIEF crud) → SELF + one BRANCH
  assert.ok(scopes.some((s) => s.kind === "BRANCH"));
  assert.ok(scopes.some((s) => s.kind === "SELF"));
  assert.equal(scopes.filter((s) => s.kind === "BRANCH").length, 1, "BRANCH not duplicated");
});

test("cru expands to update but NOT destroy; crud grants destroy", () => {
  assert.equal(can(RULES, manager, "Quotation", "update"), true); // via cru
  assert.equal(can(RULES, manager, "Quotation", "destroy"), false); // cru has no destroy
  const senior: Actor = { id: 40, department: "SALES", level: "SENIOR MANAGER", branchId: 1 };
  assert.equal(can(RULES, senior, "Customer", "destroy"), true); // crud grants destroy
});

test("level range excludes out-of-range levels", () => {
  // STAFF is below MANAGER, so the MANAGER..CHIEF ALL quotation rule must NOT apply.
  const onlySelf = effectiveScopes(RULES, staff, "Quotation", "update");
  assert.deepEqual(onlySelf, [{ kind: "SELF", sourceField: "id", destField: "sales_id" }]);
});

test("DEPT ALL rules apply across departments", () => {
  assert.equal(can(RULES, faStaff, "User", "edit"), true);
  assert.deepEqual(effectiveScopes(RULES, faStaff, "User", "edit"), [
    { kind: "SELF", sourceField: "id", destField: "id" },
  ]);
});

test("unrelated department gets nothing from SALES-only rules", () => {
  assert.equal(can(RULES, faStaff, "Quotation", "index"), false);
  assert.equal(widestScope(RULES, faStaff, "Quotation", "index"), "NONE");
});

test("null level or department denies", () => {
  const nullish: Actor = { id: 99, department: null, level: null, branchId: null };
  assert.equal(can(RULES, nullish, "Quotation", "index"), false);
});
