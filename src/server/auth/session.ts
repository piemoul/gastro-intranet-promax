import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { DEPARTMENTS, LEVELS } from "@/lib/constants";

const COOKIE = "gastro_intranet_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function sessionSecret(): Uint8Array {
  const configured = process.env.SESSION_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV === "production")
      throw new Error("SESSION_SECRET wajib di-set di production.");
    return new TextEncoder().encode("dev-only-insecure-session-secret");
  }
  if (configured.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter.");
  return new TextEncoder().encode(configured);
}

const secret = sessionSecret();

const sessionSchema = z.object({
  uid: z.number().int().positive(),
  email: z.string().email(),
  name: z.string().trim().min(1).max(200),
  department: z.enum(DEPARTMENTS).nullable(),
  level: z.enum(LEVELS).nullable(),
  branchId: z.number().int().positive().nullable(),
  loginAt: z.string().min(1).max(100),
});

/** The signed session cookie — the identity + attributes the permission engine needs. */
export type Session = z.infer<typeof sessionSchema>;

export async function setSession(s: Session): Promise<void> {
  const validated = sessionSchema.parse(s);
  const token = await new SignJWT(validated as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const parsed = sessionSchema.safeParse(payload);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
