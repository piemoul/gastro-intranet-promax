/**
 * Script-only database client. Unlike src/server/db/client.ts this does NOT
 * import `server-only`, so it can run under plain tsx (seed, scraper, checks).
 * Uses the DIRECT (unpooled) connection via postgres.js.
 */
import "./_env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/server/db/schema";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED / DATABASE_URL not set");

export const sql = postgres(url, { max: 4, prepare: false });
export const db = drizzle(sql, { schema });
export { schema };
