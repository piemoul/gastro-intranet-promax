import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";

export type { Sql, TransactionSql } from "postgres";
let sharedSql: Sql | undefined;
const migrations = new WeakMap<Sql, Map<string, Promise<void>>>();

/** The cloud database is exclusively configured by Intranet's DATABASE_URL. */
export function createSql(connectionString: string): Sql {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error("DATABASE_URL Intranet tidak valid."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error("DATABASE_URL harus menunjuk database PostgreSQL untuk tabel Intranet.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return postgres(connectionString, {
    max: 5,
    prepare: false,
    ssl: local ? false : "verify-full",
    idle_timeout: 20,
    connect_timeout: 15,
    max_lifetime: 1_800,
    connection: { application_name: "gastro-intranet" },
    onnotice: () => undefined,
  });
}

export function getSql(): Sql {
  if (sharedSql) return sharedSql;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL Intranet belum dikonfigurasi.");
  sharedSql = createSql(process.env.DATABASE_URL);
  return sharedSql;
}

/** Cross-instance DDL serialization; failed migrations can be safely retried. */
export function ensureSchema(key: string, migrate: (transaction: TransactionSql) => Promise<void>, sql: Sql = getSql()): Promise<void> {
  if (!/^[a-z0-9-]{1,80}$/.test(key)) throw new Error("Nama migrasi Intranet tidak valid.");
  let byKey = migrations.get(sql);
  if (!byKey) { byKey = new Map(); migrations.set(sql, byKey); }
  const previous = byKey.get(key);
  if (previous) return previous;
  const promise = sql.begin(async transaction => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('gastro-intranet:schema'))`;
    await transaction`CREATE TABLE IF NOT EXISTS intranet_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    const applied = await transaction<{ version: string }[]>`SELECT version FROM intranet_schema_migrations WHERE version=${key}`;
    if (applied.length) return;
    await migrate(transaction);
    await transaction`INSERT INTO intranet_schema_migrations (version) VALUES (${key})`;
  }).then(() => undefined).catch(error => {
    byKey!.delete(key);
    throw error;
  });
  byKey.set(key, promise);
  return promise;
}

export async function closeSql(): Promise<void> {
  const sql = sharedSql;
  sharedSql = undefined;
  if (sql) await sql.end({ timeout: 5 });
}
