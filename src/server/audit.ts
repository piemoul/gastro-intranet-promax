import "server-only";
import { db } from "@/server/db/client";
import { auditVersions } from "@/server/db/schema";
import type { Session } from "@/server/auth/session";

export type Change = { field: string; before: string | null; after: string | null };

const str = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);

/** Diff two records into a changeset, ignoring bookkeeping columns. */
export function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  ignore: string[] = ["id", "createdAt", "updatedAt", "legacyId"],
): Change[] {
  const out: Change[] = [];
  const keys = new Set([...(before ? Object.keys(before) : []), ...Object.keys(after)]);
  for (const k of keys) {
    if (ignore.includes(k)) continue;
    if (!(k in after)) continue; // only record fields the write actually touched
    const b = str(before?.[k]);
    const a = str(after[k]);
    if (b !== a) out.push({ field: k, before: b, after: a });
  }
  return out;
}

/**
 * Record a change. Mirrors the legacy /statics/*_logs changesets so the Logs
 * module keeps working for data created in the new system.
 */
export async function recordAudit(opts: {
  model: string;
  recordId: number;
  event: "create" | "update" | "destroy";
  session: Session | null;
  changes: Change[];
}): Promise<void> {
  if (opts.event === "update" && opts.changes.length === 0) return;
  await db.insert(auditVersions).values({
    model: opts.model,
    recordId: opts.recordId,
    event: opts.event,
    userId: opts.session?.uid ?? null,
    userLabel: opts.session
      ? `${opts.session.name}${opts.session.department ? ` (Dept: ${opts.session.department})` : ""}`
      : null,
    changeset: opts.changes,
    legacyCreatedAt: new Date(),
  });
}
