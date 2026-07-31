/**
 * Shared env loader for standalone scripts (tsx) and drizzle-kit.
 *
 * Next.js auto-loads `.env.local`, but `dotenv/config` only reads `.env`. Import
 * this module FIRST in any script so process.env is populated from `.env.local`
 * (preferred) with `.env` as a fallback, before anything reads the values.
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local" });
config(); // .env fallback (no-op if absent)
