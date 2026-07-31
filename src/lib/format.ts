/** Shared display formatters (Indonesian locale). */

export function idr(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return "IDR " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function money(amount: string | number | null | undefined, currency = "IDR"): string {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${currency} ${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}

export function pct(fraction: string | number | null | undefined): string {
  if (fraction == null) return "—";
  const n = typeof fraction === "string" ? Number(fraction) : fraction;
  if (!Number.isFinite(n)) return "—";
  return (n * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + "%";
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return typeof d === "string" ? d : "—";
  return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
