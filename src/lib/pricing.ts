/**
 * Pricing & margin engine ported from the legacy /quotations/:id/analysis view.
 *
 * Verified worked example (QUOT-KA-2026-07-0045, item KUF-1270):
 *   buyPrice = IDR 8,285,500 ; multiplier = 1.2 → COGS = 9,942,600
 *   sell = IDR 14,100,000 → gross margin = 4,157,400 = 41.81% of COGS
 * i.e. GM% is markup-on-COST, NOT margin-on-revenue.
 *
 * Money is handled with decimal.js end-to-end — inputs may arrive as strings
 * (Drizzle `numeric` columns) and must never round-trip through float.
 */
import Decimal from "decimal.js";
import type { Currency } from "./constants";

// Enough precision for IDR values in the billions with cross-rate conversions.
Decimal.set({ precision: 40 });

export type Num = string | number | Decimal;

/** FX snapshot copied onto a quotation. Cross rates are "<CUR> per 1 USD"; usdIdr is IDR per 1 USD. */
export type FxSnapshot = {
  usdIdr: Num;
  eurUsd: Num;
  sgdUsd: Num;
  jpyUsd: Num;
  nzdUsd: Num;
  gbpUsd: Num;
  krwUsd: Num;
  rmbUsd: Num;
  sekUsd: Num;
};

const d = (v: Num): Decimal => (v instanceof Decimal ? v : new Decimal(v ?? 0));

/** Non-USD, non-IDR currency → its "<CUR>_USD" cross rate from the snapshot. */
function crossToUsd(currency: Currency, fx: FxSnapshot): Decimal {
  switch (currency) {
    case "EUR":
      return d(fx.eurUsd);
    case "SGD":
      return d(fx.sgdUsd);
    case "JPY":
      return d(fx.jpyUsd);
    case "NZD":
      return d(fx.nzdUsd);
    case "GBP":
      return d(fx.gbpUsd);
    case "KRW":
      return d(fx.krwUsd);
    case "RMB":
      return d(fx.rmbUsd);
    case "SEK":
      return d(fx.sekUsd);
    default:
      return new Decimal(1);
  }
}

/** Convert any supported currency amount to USD using the snapshot. */
export function toUsd(amount: Num, currency: Currency, fx: FxSnapshot): Decimal {
  const a = d(amount);
  if (currency === "USD") return a;
  if (currency === "IDR") return a.div(d(fx.usdIdr));
  return a.mul(crossToUsd(currency, fx));
}

/** Convert any supported currency amount to IDR using the snapshot. */
export function toIdr(amount: Num, currency: Currency, fx: FxSnapshot): Decimal {
  const a = d(amount);
  if (currency === "IDR") return a;
  if (currency === "USD") return a.mul(d(fx.usdIdr));
  return a.mul(crossToUsd(currency, fx)).mul(d(fx.usdIdr));
}

/** COGS in IDR = buyPrice (converted to IDR) × cost multiplier. */
export function cogsIdr(
  buyPrice: Num,
  buyCurrency: Currency,
  multiplier: Num,
  fx: FxSnapshot,
): Decimal {
  return toIdr(buyPrice, buyCurrency, fx).mul(d(multiplier));
}

/** Gross margin amount (IDR): sell − cogs. */
export function grossMargin(sellIdr: Num, cogsIdr: Num): Decimal {
  return d(sellIdr).sub(d(cogsIdr));
}

/** Gross margin % of COST: (sell − cogs) / cogs. Returns 0 when cogs is 0. */
export function grossMarginPct(sellIdr: Num, cogsIdr: Num): Decimal {
  const cogs = d(cogsIdr);
  if (cogs.isZero()) return new Decimal(0);
  return d(sellIdr).sub(cogs).div(cogs);
}

/** Resolve a sell price from a tier base + adjustment %, e.g. "Tier 3 + 1.3%". */
export function resolveSellPrice(tierBase: Num, adjustmentPct: Num = 0): Decimal {
  return d(tierBase).mul(new Decimal(1).add(d(adjustmentPct).div(100)));
}

/** Optional IDR rounding (legacy `round_idr_option`) — nearest `unit` rupiah. */
export function roundIdr(amount: Num, enabled: boolean, unit: number = 1000): Decimal {
  const a = d(amount);
  if (!enabled) return a;
  const u = new Decimal(unit);
  return a.div(u).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(u);
}

export type QuotationLine = {
  qty: Num;
  currency: Currency;
  price: Num; // unit sell price in `currency`
  deliveryCost?: Num;
  installCost?: Num;
  // Cost side (optional — only present for margin analysis).
  buyPrice?: Num;
  buyCurrency?: Currency;
  multiplier?: Num;
};

export type LineResult = {
  sellIdr: Decimal; // qty × price (+ D&I if included), in IDR
  diIdr: Decimal; // delivery + install, in IDR
  cogsIdr: Decimal;
  marginIdr: Decimal;
  marginPct: Decimal;
};

export type QuotationOptions = {
  fx: FxSnapshot;
  includeDiInPrice?: boolean;
  roundIdrOption?: boolean;
};

/** Compute a single line's sell / D&I / COGS / margin, all in IDR. */
export function lineResult(line: QuotationLine, opts: QuotationOptions): LineResult {
  const { fx } = opts;
  const unit = toIdr(line.price, line.currency, fx);
  const base = unit.mul(d(line.qty));
  const di = toIdr(line.deliveryCost ?? 0, line.currency, fx).add(
    toIdr(line.installCost ?? 0, line.currency, fx),
  );
  let sellIdr = opts.includeDiInPrice ? base.add(di) : base;
  sellIdr = roundIdr(sellIdr, Boolean(opts.roundIdrOption));

  const cogs =
    line.buyPrice != null && line.multiplier != null
      ? cogsIdr(line.buyPrice, line.buyCurrency ?? line.currency, line.multiplier, fx).mul(d(line.qty))
      : new Decimal(0);

  return {
    sellIdr,
    diIdr: di,
    cogsIdr: cogs,
    marginIdr: grossMargin(sellIdr, cogs),
    marginPct: grossMarginPct(sellIdr, cogs),
  };
}

export type QuotationTotals = {
  totalSellIdr: Decimal;
  totalCogsIdr: Decimal;
  totalMarginIdr: Decimal;
  marginPct: Decimal;
  lines: LineResult[];
};

/** Roll up all lines into quotation totals (matches the Analysis totals row). */
export function quotationTotals(lines: QuotationLine[], opts: QuotationOptions): QuotationTotals {
  const results = lines.map((l) => lineResult(l, opts));
  const totalSellIdr = results.reduce((s, r) => s.add(r.sellIdr), new Decimal(0));
  const totalCogsIdr = results.reduce((s, r) => s.add(r.cogsIdr), new Decimal(0));
  return {
    totalSellIdr,
    totalCogsIdr,
    totalMarginIdr: totalSellIdr.sub(totalCogsIdr),
    marginPct: grossMarginPct(totalSellIdr, totalCogsIdr),
    lines: results,
  };
}
