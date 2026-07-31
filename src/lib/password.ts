import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Pure password hashing (scrypt) — usable by server code AND local scripts
// (seed/scraper). No `server-only` guard here; the app imports the guarded
// re-export in src/server/auth/password.ts.
const scrypt = promisify(scryptCb);

/** Hash a password as "scrypt$<saltHex>$<hashHex>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verify a password against a stored scrypt hash (constant-time). */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
