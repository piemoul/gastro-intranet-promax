/**
 * Accurate Online client for the intranet — **GET only by default**.
 *
 * Credentials are read from the sibling gastro-wms .env (single source of truth).
 * Write helpers live in `write.ts` and are deliberately separate so that nothing
 * here can mutate Accurate. Company mapping matches gastro-wms:
 *   1 = GASTRO · 2 = RSP · 3 = SARANA
 */
import { existsSync } from "node:fs";
import crypto from "node:crypto";
import { config } from "dotenv";
import "../_env";

const WMS_ENV = "/Users/user/Documents/coding disini/gastro-wms/.env";
if (existsSync(WMS_ENV)) config({ path: WMS_ENV });

export const ACCURATE_HOST = process.env.ACCURATE_HOST ?? "https://iris.accurate.id";
const SIGNATURE_KEY = process.env.ACCURATE_SIGNATURE_KEY ?? "";

/** Our companyName ↔ Accurate company id. */
export const COMPANY_ID: Record<string, number> = { GASTRO: 1, RSP: 2, SARANA: 3 };
export const COMPANY_NAME: Record<number, string> = { 1: "GASTRO", 2: "RSP", 3: "SARANA" };

export function tokenFor(companyId: number): string | undefined {
  return companyId === 1
    ? process.env.ACCURATE_API_TOKEN
    : companyId === 2
      ? process.env.ACCURATE_API_TOKEN_RSP
      : companyId === 3
        ? process.env.ACCURATE_API_TOKEN_SARANA
        : undefined;
}

/** Accurate wants `dd/MM/yyyy HH:mm:ss` in WIB, and signs that exact string. */
export function timestampWIB(): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date())) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export function signedHeaders(companyId: number): Record<string, string> {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with light retry/backoff. Never mutates anything. */
export async function accurateGet<T>(
  companyId: number,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<AccurateResponse<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${ACCURATE_HOST}/accurate/api/${path}${qs.toString() ? `?${qs}` : ""}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: signedHeaders(companyId), cache: "no-store" });
    const json = (await res.json()) as AccurateResponse<T> & { d?: unknown };
    if (res.ok && json.s !== false) return json;
    const retryable =
      res.status === 429 || res.status >= 500 || /melebihi toleransi|rate.?limit/i.test(JSON.stringify(json.d ?? ""));
    if (retryable && attempt < 3) {
      await sleep(800 * 2 ** attempt);
      continue;
    }
    throw new Error(`Accurate ${path}: ${JSON.stringify(json.d ?? json).slice(0, 200)}`);
  }
  throw new Error(`Accurate ${path}: retry habis`);
}

/** Page through a list endpoint until exhausted. */
export async function accurateList<T>(
  companyId: number,
  path: string,
  fields: string,
  opts: { pageSize?: number; maxPages?: number; extra?: Record<string, string | number> } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 200;
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await accurateGet<T[]>(companyId, path, {
      fields,
      "sp.pageSize": pageSize,
      "sp.page": page,
      ...(opts.extra ?? {}),
    });
    const rows = r.d ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
