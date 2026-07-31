import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * App database client (used by Server Actions & Route Handlers).
 *
 * Uses the Neon serverless driver over WebSockets so we get REAL interactive
 * transactions — a quotation writes its header + line items + audit version
 * atomically. Point DATABASE_URL at the Neon **pooled** connection string.
 *
 * Node 22+ (incl. Vercel) exposes a global WebSocket, so no `ws` shim is needed.
 */
const connectionString = process.env.DATABASE_URL;

// Reuse the pool across hot-reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };
const pool = globalForDb._pgPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
