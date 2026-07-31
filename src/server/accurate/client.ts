import "server-only";
import crypto from "node:crypto";

/**
 * Accurate Online client for the intranet.
 *
 * SAFETY: `accuratePost` is the ONLY function here that can change anything in
 * Accurate, and it refuses to run unless ACCURATE_WRITE_ENABLED=1 is set. Until
 * the operator flips that flag the whole integration behaves as read-only and
 * push actions report what they *would* send (dry run).
 */
const HOST = process.env.ACCURATE_HOST ?? "https://iris.accurate.id";
const SIGNATURE_KEY = process.env.ACCURATE_SIGNATURE_KEY ?? "";

export const COMPANY_ID: Record<string, number> = { GASTRO: 1, RSP: 2, SARANA: 3 };

/** Writes are opt-in via env, so a misconfigured deploy can never mutate Accurate. */
export function writesEnabled(): boolean {
  return process.env.ACCURATE_WRITE_ENABLED === "1";
}

function tokenFor(companyId: number): string | undefined {
  return companyId === 1
    ? process.env.ACCURATE_API_TOKEN
    : companyId === 2
      ? process.env.ACCURATE_API_TOKEN_RSP
      : companyId === 3
        ? process.env.ACCURATE_API_TOKEN_SARANA
        : undefined;
}

export function accurateConfigured(companyId: number): boolean {
  return Boolean(tokenFor(companyId) && SIGNATURE_KEY);
}

function timestampWIB(): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date())) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

function signedHeaders(companyId: number): Record<string, string> {
  const token = tokenFor(companyId);
  if (!token) throw new Error(`Token Accurate untuk company #${companyId} belum di-set.`);
  if (!SIGNATURE_KEY) throw new Error("ACCURATE_SIGNATURE_KEY belum di-set.");
  const ts = timestampWIB();
  return {
    Authorization: `Bearer ${token}`,
    "X-Api-Timestamp": ts,
    "X-Api-Signature": crypto.createHmac("sha256", SIGNATURE_KEY).update(ts).digest("base64"),
  };
}

export type AccurateResponse<T> = {
  s: boolean;
  d: T;
  sp?: { rowCount: number; pageCount: number; page: number; pageSize: number };
};

function detail(json: { d?: unknown }, status: number): string {
  if (Array.isArray(json.d)) return json.d.join("; ");
  if (typeof json.d === "string" && json.d.trim()) return json.d;
  return `HTTP ${status}`;
}

/** Read from Accurate. Safe to call anywhere. */
export async function accurateGet<T>(
  companyId: number,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<AccurateResponse<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${HOST}/accurate/api/${path}${qs.toString() ? `?${qs}` : ""}`, {
    headers: signedHeaders(companyId),
    cache: "no-store",
  });
  const json = (await res.json()) as AccurateResponse<T> & { d?: unknown };
  if (!res.ok || json.s === false) throw new Error(`Accurate ${path}: ${detail(json, res.status)}`);
  return json;
}

export class AccurateWriteDisabledError extends Error {
  constructor() {
    super(
      "Penulisan ke Accurate dimatikan. Set ACCURATE_WRITE_ENABLED=1 untuk mengaktifkan (default: aman/read-only).",
    );
    this.name = "AccurateWriteDisabledError";
  }
}

/**
 * Write to Accurate (form-urlencoded, the save.do convention).
 * Guarded: throws unless ACCURATE_WRITE_ENABLED=1.
 */
export async function accuratePost<T>(
  companyId: number,
  path: string,
  params: Record<string, string>,
): Promise<AccurateResponse<T>> {
  if (!writesEnabled()) throw new AccurateWriteDisabledError();
  const res = await fetch(`${HOST}/accurate/api/${path}`, {
    method: "POST",
    headers: { ...signedHeaders(companyId), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as AccurateResponse<T> & { d?: unknown };
  if (!res.ok || json.s === false) throw new Error(`Accurate ${path}: ${detail(json, res.status)}`);
  return json;
}

/**
 * Find an existing customer by code (read-only).
 *
 * IMPORTANT: `customer/list.do` silently IGNORES `filter.customerNo.*` — it
 * returns the full list, so trusting `d[0]` would attach an order to whatever
 * customer happens to sort first. Verified against the live API: only
 * `keywords` is honoured. We therefore search with `keywords` AND re-check the
 * returned code ourselves, so a future API change can never mis-match a customer.
 */
export async function findCustomerNo(companyId: number, customerNo: string): Promise<string | null> {
  const wanted = customerNo.trim().toUpperCase();
  if (!wanted) return null;
  const r = await accurateGet<{ customerNo?: string }[]>(companyId, "customer/list.do", {
    fields: "id,customerNo",
    keywords: customerNo.trim(),
    "sp.pageSize": 50,
  });
  const hit = (r.d ?? []).find((c) => (c.customerNo ?? "").trim().toUpperCase() === wanted);
  return hit?.customerNo ?? null;
}
