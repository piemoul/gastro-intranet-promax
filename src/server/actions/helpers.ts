import "server-only";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/guard";
import type { PermModel, PrimitiveAction } from "@/lib/constants";
import type { FormState } from "@/lib/form-defs";

/** Guard a write action. Returns a FormState error instead of throwing, so the form can show it. */
export async function guardWrite(
  model: PermModel,
  action: PrimitiveAction,
): Promise<{ ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { ok: false; state: FormState }> {
  const session = await getSession();
  if (!session) return { ok: false, state: { error: "Sesi berakhir. Silakan login ulang." } };
  if (!(await can(model, action)))
    return { ok: false, state: { error: `Anda tidak punya izin untuk ${model}::${action}.` } };
  return { ok: true, session };
}

/* ---------- FormData coercion ---------- */

export const s = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

export const num = (fd: FormData, k: string): string | null => {
  const v = s(fd, k);
  if (v == null) return null;
  const cleaned = v.replace(/,/g, "");
  return Number.isFinite(Number(cleaned)) ? cleaned : null;
};

export const int = (fd: FormData, k: string): number | null => {
  const v = s(fd, k);
  if (v == null) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

export const bool = (fd: FormData, k: string): boolean => fd.get(k) === "1";

/** Collect an indexed nested collection, e.g. lines[0][qty] → [{qty: "..."}]. */
export function nestedRows(fd: FormData, prefix: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (const [key, value] of fd.entries()) {
    const m = key.match(new RegExp(`^${prefix}\\[(\\d+)\\]\\[([a-zA-Z_0-9]+)\\]$`));
    if (!m || typeof value !== "string") continue;
    const i = Number(m[1]);
    (rows[i] ??= {})[m[2]] = value;
  }
  return rows.filter(Boolean);
}

/** Map a Postgres/driver error into a friendly form error. */
export function dbError(e: unknown): FormState {
  const msg = e instanceof Error ? e.message : String(e);
  if (/duplicate key|unique constraint/i.test(msg)) {
    const m = msg.match(/Key \((\w+)\)/);
    return {
      error: m ? `Nilai ${m[1]} sudah dipakai. Gunakan nilai lain.` : "Data duplikat — nilai unik sudah dipakai.",
    };
  }
  if (/foreign key/i.test(msg)) return { error: "Referensi tidak valid (data terkait tidak ditemukan)." };
  console.error("[action]", e);
  return { error: "Gagal menyimpan. Silakan coba lagi." };
}
