import { existsSync } from "node:fs";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) config({ path: ".env.local" });
config();

// Migrations & generate run from a local Node process, so use the DIRECT (unpooled)
// connection when available; fall back to the pooled one.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
