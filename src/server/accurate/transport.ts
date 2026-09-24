import { createHmac } from "node:crypto";

/** No write endpoint or caller-controlled method exists in this transport. */
export const READ_ENDPOINTS = [
  "purchase-order/list.do", "purchase-order/detail.do",
  "sales-quotation/list.do", "sales-quotation/detail.do",
  "sales-order/list.do", "sales-order/detail.do",
  "item/list.do", "item/detail.do",
  "customer/list.do", "customer/detail.do", "vendor/list.do",
] as const;
export type ReadEndpoint = (typeof READ_ENDPOINTS)[number];
export type CompanyId = 1 | 2 | 3;
export type AccurateResponse<T> = { s: boolean; d: T; sp?: { rowCount?: number; pageCount?: number; page?: number; pageSize?: number } };
export type ReadParams = Record<string, string | number | boolean | undefined>;
export class AccurateReadError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "NOT_CONFIGURED" | "UPSTREAM" | "RATE_LIMIT" | "TIMEOUT", message: string) {
    super(message); this.name = "AccurateReadError";
  }
}
export function companyId(value: number): CompanyId {
  if (value !== 1 && value !== 2 && value !== 3) throw new AccurateReadError("INVALID_INPUT", "PT tidak valid.");
  return value;
}
export function accurateHost(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AccurateReadError("NOT_CONFIGURED", "Host Accurate tidak valid."); }
  if (url.protocol !== "https:" || !/^(?:[a-z0-9-]+\.)*accurate\.id$/.test(url.hostname) || url.username || url.password || url.port || !["", "/"].includes(url.pathname) || url.search || url.hash) {
    throw new AccurateReadError("NOT_CONFIGURED", "Host Accurate harus HTTPS pada domain Accurate tanpa path tambahan.");
  }
  return url.origin;
}
export function accurateTimestamp(now: Date): string {
  const fields: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now).forEach(p => { fields[p.type] = p.value; });
  return `${fields.day}/${fields.month}/${fields.year} ${fields.hour}:${fields.minute}:${fields.second}`;
}
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let gate: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
async function waitForSlot(): Promise<void> {
  const slot = gate.then(async () => { await pause(Math.max(0, nextRequestAt - Date.now())); nextRequestAt = Date.now() + 350; });
  gate = slot.catch(() => undefined); await slot;
}
export function createAccurateTransport(config: {
  host: string; signatureKey: string; tokenForCompany: (id: CompanyId) => string | undefined;
  fetchImpl?: typeof fetch; now?: () => Date; waitForSlot?: () => Promise<void>;
}) {
  const host = accurateHost(config.host);
  return async function accurateRead<T>(id: number, endpoint: ReadEndpoint, params: ReadParams = {}): Promise<AccurateResponse<T>> {
    const company = companyId(id);
    if (!(READ_ENDPOINTS as readonly string[]).includes(endpoint)) throw new AccurateReadError("INVALID_INPUT", "Endpoint Accurate diblokir: hanya pembacaan yang diizinkan.");
    const token = config.tokenForCompany(company);
    if (!token || !config.signatureKey) throw new AccurateReadError("NOT_CONFIGURED", `Koneksi Accurate PT ${company} belum dikonfigurasi.`);
    const url = new URL(`/accurate/api/${endpoint}`, host);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") throw new AccurateReadError("INVALID_INPUT", "Parameter Accurate tidak valid.");
      url.searchParams.set(key, String(value));
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await (config.waitForSlot ?? waitForSlot)();
      const timestamp = accurateTimestamp((config.now ?? (() => new Date()))());
      let response: Response;
      try {
        response = await (config.fetchImpl ?? fetch)(url, {
          method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
          headers: { Authorization: `Bearer ${token}`, "X-Api-Timestamp": timestamp, "X-Api-Signature": createHmac("sha256", config.signatureKey).update(timestamp).digest("base64"), Accept: "application/json" },
        });
      } catch {
        // Never expose fetch errors: they can contain signed headers or request details.
        throw new AccurateReadError("TIMEOUT", "Accurate belum dapat dihubungi. Coba kembali sebentar lagi.");
      }
      if (response.status === 429 && attempt === 0) { await pause(1_000); continue; }
      let body: AccurateResponse<T>;
      try { body = await response.json() as AccurateResponse<T>; } catch { throw new AccurateReadError("UPSTREAM", "Respons Accurate tidak valid."); }
      if (!response.ok || !body || body.s !== true) {
        throw new AccurateReadError(response.status === 429 ? "RATE_LIMIT" : "UPSTREAM", response.status === 401 || response.status === 403 ? "Akses Accurate ditolak. Periksa hak baca koneksi PT ini." : `Pembacaan Accurate gagal (HTTP ${response.status}).`);
      }
      return body;
    }
    throw new AccurateReadError("RATE_LIMIT", "Batas pembacaan Accurate tercapai. Coba kembali sebentar lagi.");
  };
}
