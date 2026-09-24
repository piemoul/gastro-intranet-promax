import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateTransaction } from "../src/lib/calculations";
import { emptyTransaction, type TransactionLine } from "../src/lib/domain";

const line = (changes:Partial<TransactionLine>={}):TransactionLine => ({id:"line",itemId:1,itemNo:"ITEM",name:"Item",unit:"PCS",quantity:1,unitPrice:100,discountPercent:0,taxPercent:11,warehouse:"",notes:"",...changes});

test("line and document discounts apply before exclusive tax", () => {
  const result = estimateTransaction({...emptyTransaction(),discountPercent:5,lines:[line({quantity:2,discountPercent:10})]});
  assert.equal(result.subtotal,200);
  assert.equal(result.lineDiscount,20);
  assert.equal(result.documentDiscount,9);
  assert.equal(result.discount,29);
  assert.equal(result.tax,18.81);
  assert.equal(result.total,189.81);
  assert.equal(result.lines[0].taxableBase,171);
  assert.equal(result.isEstimate,true);
});

test("inclusive tax extracts tax without adding it twice", () => {
  const result = estimateTransaction({...emptyTransaction(),inclusiveTax:true,lines:[line({unitPrice:111})]});
  assert.equal(result.lines[0].taxableBase,100);
  assert.equal(result.tax,11);
  assert.equal(result.total,111);
});

test("partial taxable base produces effective 11 percent from a nominal 12 percent rate", () => {
  const exclusive = estimateTransaction({...emptyTransaction(),lines:[line({unitPrice:100_000,taxPercent:12,taxBasePercent:91.666667})]});
  assert.equal(exclusive.tax,11_000);
  assert.equal(exclusive.total,111_000);
  assert.equal(exclusive.lines[0].taxableBase,91_666.67);
  const inclusive = estimateTransaction({...emptyTransaction(),inclusiveTax:true,lines:[line({unitPrice:111_000,taxPercent:12,taxBasePercent:91.666667})]});
  assert.equal(inclusive.tax,11_000);
  assert.equal(inclusive.total,111_000);
  const zeroBase = estimateTransaction({...emptyTransaction(),lines:[line({taxPercent:12,taxBasePercent:0})]});
  assert.equal(zeroBase.tax,0);
  assert.equal(zeroBase.total,100);
});

test("decimal quantities and half-cent values use consistent half-up rounding", () => {
  const result = estimateTransaction({...emptyTransaction(),lines:[line({quantity:0.3,unitPrice:0.1,taxPercent:0}),line({id:"second",quantity:1,unitPrice:1.005,taxPercent:0})]});
  assert.equal(result.lines[0].total,0.03);
  assert.equal(result.lines[1].total,1.01);
  assert.equal(result.total,1.04);
});

test("document discount allocation conserves cents across mixed tax lines", () => {
  const result = estimateTransaction({...emptyTransaction(),discountPercent:10,lines:[line({id:"1",unitPrice:0.05,taxPercent:0}),line({id:"2",unitPrice:0.05,taxPercent:11}),line({id:"3",unitPrice:0.05,taxPercent:0})]});
  assert.equal(result.documentDiscount,0.02);
  assert.deepEqual(result.lines.map(row=>row.documentDiscount),[0.01,0.01,0]);
  assert.equal(result.total,0.13);
});

test("zero lines and 100 percent discounts result in a finite zero total", () => {
  assert.equal(estimateTransaction(emptyTransaction()).total,0);
  const result = estimateTransaction({...emptyTransaction(),discountPercent:100,lines:[line()]});
  assert.equal(result.total,0); assert.equal(result.tax,0);
});

test("unsafe, negative, infinite and invalid percentage values are rejected", () => {
  for (const changes of [{quantity:-1},{quantity:Infinity},{unitPrice:NaN},{discountPercent:101},{taxPercent:-1}]) {
    assert.throws(() => estimateTransaction({...emptyTransaction(),lines:[line(changes)]}));
  }
  assert.throws(() => estimateTransaction({...emptyTransaction(),lines:[line({quantity:1_000_000_000,unitPrice:1_000_000_000_000})]}),RangeError);
});
