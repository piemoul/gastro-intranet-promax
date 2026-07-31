/**
 * Verify .env credentials & Neon connectivity without leaking secrets.
 *   npm run db:check
 */
import "./_env";
import postgres from "postgres";

function mask(url?: string): string {
  if (!url) return "(not set)";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? "***:***@" : ""}${u.host}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const { DATABASE_URL, DATABASE_URL_UNPOOLED, SESSION_SECRET, LEGACY_BASE_URL } = process.env;

  console.log("=== .env presence ===");
  console.log(
    "DATABASE_URL          :",
    mask(DATABASE_URL),
    DATABASE_URL ? (DATABASE_URL.includes("-pooler") ? "[pooled ✓]" : "[NOT pooled ⚠]") : "",
  );
  console.log(
    "DATABASE_URL_UNPOOLED :",
    mask(DATABASE_URL_UNPOOLED),
    DATABASE_URL_UNPOOLED
      ? DATABASE_URL_UNPOOLED.includes("-pooler")
        ? "[has -pooler ⚠]"
        : "[direct ✓]"
      : "",
  );
  console.log(
    "SESSION_SECRET        :",
    SESSION_SECRET ? `set ✓ (${SESSION_SECRET.length} chars)` : "(not set ⚠)",
  );
  console.log("LEGACY_BASE_URL       :", LEGACY_BASE_URL ?? "(not set)");

  const directUrl = DATABASE_URL_UNPOOLED ?? DATABASE_URL;
  if (!directUrl) {
    console.error("\n✗ No database URL configured.");
    process.exit(1);
  }

  console.log("\n=== Neon connectivity (direct) ===");
  const sql = postgres(directUrl, { max: 1, prepare: false });
  try {
    const [row] = await sql`select version() as v, current_database() as db`;
    console.log("✓ Connected:", row.db);
    console.log("  ", String(row.v).split(",")[0]);
    const tables = await sql<{ count: number }[]>`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public'`;
    console.log(`  public tables: ${tables[0].count}`);
  } catch (e) {
    console.error("✗ Connection failed:", (e as Error).message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
