import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canDecide,
  canPushToAccurate,
  canSubmit,
  isLocked,
  soBadge,
} from "../src/lib/so-workflow";

const admin = { id: 1, isAdmin: true };
const sales = { id: 2, isAdmin: false };
const sq = { soStatus: null, accurateSyncedAt: null };
const submitted = { soStatus: "SUBMITTED", accurateSyncedAt: null };
const approved = { soStatus: "APPROVED", accurateSyncedAt: null };
const rejected = { soStatus: "REJECTED", accurateSyncedAt: null };
const synced = { soStatus: "APPROVED", accurateSyncedAt: new Date() };

test("a plain SQ can be submitted; a submitted one cannot be resubmitted", () => {
  assert.equal(canSubmit(sq), true);
  assert.equal(canSubmit(submitted), false);
  assert.equal(canSubmit(approved), false);
});

test("a rejected order can be revised and resubmitted", () => {
  assert.equal(canSubmit(rejected), true);
});

test("only an admin decides, and only on a submitted order", () => {
  assert.equal(canDecide(submitted, admin), true);
  assert.equal(canDecide(submitted, sales), false, "sales must not approve");
  assert.equal(canDecide(sq, admin), false, "nothing to decide yet");
  assert.equal(canDecide(approved, admin), false, "already decided");
});

test("only an approved, unsynced order may be pushed to Accurate", () => {
  assert.equal(canPushToAccurate(approved, admin), true);
  assert.equal(canPushToAccurate(submitted, admin), false, "not approved yet");
  assert.equal(canPushToAccurate(approved, sales), false, "sales must not push");
  assert.equal(canPushToAccurate(synced, admin), false, "must not push twice");
});

test("editing is frozen while awaiting approval or approved", () => {
  assert.equal(isLocked(sq), false);
  assert.equal(isLocked(rejected), false, "rejected returns to the salesman");
  assert.equal(isLocked(submitted), true);
  assert.equal(isLocked(approved), true);
});

test("badge reflects the stage, and synced wins over approved", () => {
  assert.equal(soBadge(sq).label, "SQ");
  assert.equal(soBadge(submitted).label, "MENUNGGU APPROVAL");
  assert.equal(soBadge(approved).label, "APPROVED");
  assert.equal(soBadge(rejected).label, "DITOLAK");
  assert.equal(soBadge(synced).label, "DI ACCURATE");
});
