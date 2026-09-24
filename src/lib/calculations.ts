import type { TransactionPayload } from "./domain";
import { transactionPayloadSchema } from "./validation";

const SCALE = 1_000_000n;
const PERCENT = 100n * SCALE;
const scaled = (number:number):bigint => BigInt(number.toFixed(6).replace(".", ""));
const rounded = (numerator:bigint, denominator:bigint):bigint => (numerator + denominator / 2n) / denominator;
const money = (cents:bigint):number => {
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Nilai transaksi terlalu besar untuk dihitung dengan aman.");
  return Number(cents) / 100;
};

export type EstimatedLine = { id:string; subtotal:number; lineDiscount:number; documentDiscount:number; taxableBase:number; tax:number; total:number };
export type TransactionEstimate = { subtotal:number; lineDiscount:number; documentDiscount:number; discount:number; tax:number; total:number; lines:EstimatedLine[]; currency:string; isEstimate:true };

/** Local estimate only: 6 decimal input precision, 2 decimal monetary rounding, half up.
 * Document discounts are allocated proportionally before tax using largest remainders.
 * Accurate remains authoritative; its tax configuration and rounding may differ.
 */
export function estimateTransaction(input:TransactionPayload):TransactionEstimate {
  const payload = transactionPayloadSchema.parse(input);
  const rows = payload.lines.map(line => {
    const subtotal = rounded(scaled(line.quantity) * scaled(line.unitPrice) * 100n, SCALE * SCALE);
    const discount = rounded(subtotal * scaled(line.discountPercent), PERCENT);
    return { line, subtotal, discount, net:subtotal-discount, documentDiscount:0n, remainder:0n };
  });
  const subtotal = rows.reduce((sum,row) => sum + row.subtotal, 0n);
  const lineDiscount = rows.reduce((sum,row) => sum + row.discount, 0n);
  const afterLines = subtotal - lineDiscount;
  const documentDiscount = rounded(afterLines * scaled(payload.discountPercent), PERCENT);
  if (afterLines > 0n) {
    for (const row of rows) { row.documentDiscount = documentDiscount * row.net / afterLines; row.remainder = documentDiscount * row.net % afterLines; }
    let remainder = documentDiscount - rows.reduce((sum,row) => sum + row.documentDiscount, 0n);
    for (const row of [...rows].sort((a,b) => a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1)) {
      if (remainder <= 0n) break;
      row.documentDiscount += 1n;
      remainder -= 1n;
    }
  }
  let allTax = 0n;
  let total = 0n;
  const lines = rows.map(row => {
    const net = row.net-row.documentDiscount;
    const basePercent = scaled(row.line.taxBasePercent);
    const rateNumerator = scaled(row.line.taxPercent) * basePercent;
    const rateDenominator = PERCENT * PERCENT;
    const excludingTax = payload.inclusiveTax ? rounded(net * rateDenominator, rateDenominator + rateNumerator) : net;
    const taxableBase = rounded(excludingTax * basePercent, PERCENT);
    const tax = payload.inclusiveTax ? net-excludingTax : rounded(net * rateNumerator, rateDenominator);
    const lineTotal = excludingTax + tax;
    allTax += tax;
    total += lineTotal;
    return {id:row.line.id,subtotal:money(row.subtotal),lineDiscount:money(row.discount),documentDiscount:money(row.documentDiscount),taxableBase:money(taxableBase),tax:money(tax),total:money(lineTotal)};
  });
  return {subtotal:money(subtotal),lineDiscount:money(lineDiscount),documentDiscount:money(documentDiscount),discount:money(lineDiscount+documentDiscount),tax:money(allTax),total:money(total),lines,currency:payload.currency,isEstimate:true};
}
