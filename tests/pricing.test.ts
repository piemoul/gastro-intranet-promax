import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cogsIdr,
  grossMargin,
  grossMarginPct,
  lineResult,
  quotationTotals,
  resolveSellPrice,
  roundIdr,
  toIdr,
  toUsd,
  type FxSnapshot,
} from "../src/lib/pricing";

/** The exact FX snapshot shown on QUOT-KA-2026-07-0045. */
const FX: FxSnapshot = {
  usdIdr: "18250.0",
  eurUsd: "1.15",
  sgdUsd: "0.8",
  jpyUsd: "0.0075",
  nzdUsd: "0.65",
  gbpUsd: "0.0",
  krwUsd: "0.0",
  rmbUsd: "0.15",
  sekUsd: "0.0",
};

test("verified analysis example: COGS = buy × multiplier", () => {
  const cogs = cogsIdr("8285500", "IDR", "1.2", FX);
  assert.equal(cogs.toString(), "9942600");
});

test("verified analysis example: gross margin amount and %", () => {
  const sell = "14100000";
  const cogs = "9942600";
  assert.equal(grossMargin(sell, cogs).toString(), "4157400");
  // 4,157,400 / 9,942,600 = 0.41815..., i.e. 41.81%
  const pct = grossMarginPct(sell, cogs).mul(100);
  assert.equal(pct.toDecimalPlaces(2).toString(), "41.81");
});

test("currency → IDR conversion via snapshot", () => {
  assert.equal(toIdr("100", "USD", FX).toString(), "1825000"); // 100 × 18250
  assert.equal(toIdr("100", "IDR", FX).toString(), "100");
  assert.equal(toIdr("100", "EUR", FX).toString(), "2098750"); // 100 × 1.15 × 18250
  assert.equal(toIdr("1000", "JPY", FX).toString(), "136875"); // 1000 × 0.0075 × 18250
});

test("currency → USD conversion via snapshot", () => {
  assert.equal(toUsd("18250", "IDR", FX).toString(), "1");
  assert.equal(toUsd("100", "SGD", FX).toString(), "80"); // 100 × 0.8
});

test("resolveSellPrice applies tier adjustment %", () => {
  // Tier base 762.687 + 1.3% ≈ 772.6 USD → ~14.1M IDR (matches the line)
  const sell = resolveSellPrice("762.687", "1.3");
  assert.equal(sell.toDecimalPlaces(3).toString(), "772.602");
});

test("roundIdr rounds to nearest 1000 only when enabled", () => {
  assert.equal(roundIdr("14100499", true).toString(), "14100000");
  assert.equal(roundIdr("14100500", true).toString(), "14101000");
  assert.equal(roundIdr("14100499", false).toString(), "14100499");
});

test("lineResult reproduces the verified line margin", () => {
  const r = lineResult(
    {
      qty: "1",
      currency: "IDR",
      price: "14100000",
      buyPrice: "8285500",
      buyCurrency: "IDR",
      multiplier: "1.2",
    },
    { fx: FX },
  );
  assert.equal(r.sellIdr.toString(), "14100000");
  assert.equal(r.cogsIdr.toString(), "9942600");
  assert.equal(r.marginIdr.toString(), "4157400");
  assert.equal(r.marginPct.mul(100).toDecimalPlaces(2).toString(), "41.81");
});

test("quotationTotals aggregates sell/cogs/margin across lines", () => {
  const totals = quotationTotals(
    [
      { qty: "1", currency: "IDR", price: "14100000", buyPrice: "8285500", buyCurrency: "IDR", multiplier: "1.2" },
      { qty: "2", currency: "USD", price: "100", buyPrice: "50", buyCurrency: "USD", multiplier: "1.1" },
    ],
    { fx: FX },
  );
  // line 2 sell = 2 × 100 × 18250 = 3,650,000 ; cogs = 50 × 1.1 × 18250 × 2 = 2,007,500
  assert.equal(totals.totalSellIdr.toString(), "17750000");
  assert.equal(totals.totalCogsIdr.toString(), "11950100");
  assert.equal(totals.totalMarginIdr.toString(), "5799900");
});

test("include_di_in_price folds delivery+install into sell", () => {
  const withDi = lineResult(
    { qty: "1", currency: "IDR", price: "1000000", deliveryCost: "50000", installCost: "25000" },
    { fx: FX, includeDiInPrice: true },
  );
  assert.equal(withDi.sellIdr.toString(), "1075000");
  const withoutDi = lineResult(
    { qty: "1", currency: "IDR", price: "1000000", deliveryCost: "50000", installCost: "25000" },
    { fx: FX, includeDiInPrice: false },
  );
  assert.equal(withoutDi.sellIdr.toString(), "1000000");
});
