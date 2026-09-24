import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parse } from "dotenv";
import { accurateHost, companyId, createAccurateTransport, type CompanyId } from "./transport";

// Only these integration variables may come from WMS. No database, login or session secrets are reused.
const CREDENTIAL_KEYS = ["ACCURATE_HOST", "ACCURATE_SIGNATURE_KEY", "ACCURATE_API_TOKEN", "ACCURATE_API_TOKEN_RSP", "ACCURATE_API_TOKEN_SARANA"] as const;
function readEnvironment(): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  const file = process.env.INTRANET_WMS_ENV_FILE;
  if (file && isAbsolute(file) && existsSync(file)) {
    const inherited = parse(readFileSync(file));
    for (const key of CREDENTIAL_KEYS) values[key] = inherited[key];
  }
  for (const key of CREDENTIAL_KEYS) if (process.env[key] !== undefined) values[key] = process.env[key];
  return values;
}
const TOKEN_KEYS: Record<CompanyId, string> = { 1: "ACCURATE_API_TOKEN", 2: "ACCURATE_API_TOKEN_RSP", 3: "ACCURATE_API_TOKEN_SARANA" };
export function getConnectionStatus(): { companyId: number; configured: boolean }[] {
  const env = readEnvironment();
  let hostValid = true;
  try { accurateHost(env.ACCURATE_HOST || "https://iris.accurate.id"); } catch { hostValid = false; }
  return ([1, 2, 3] as const).map(id => ({ companyId: id, configured: hostValid && !!env.ACCURATE_SIGNATURE_KEY && !!env[TOKEN_KEYS[id]] }));
}
export function getReadTransport() {
  const env = readEnvironment();
  return createAccurateTransport({ host: env.ACCURATE_HOST || "https://iris.accurate.id", signatureKey: env.ACCURATE_SIGNATURE_KEY || "", tokenForCompany: id => env[TOKEN_KEYS[companyId(id)]] });
}
