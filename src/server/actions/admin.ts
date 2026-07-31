"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { branches, itemBrands, permissions, settings, taxonomies, users } from "@/server/db/schema";
import { diff, recordAudit } from "@/server/audit";
import { getSession } from "@/server/auth/session";
import { hashPassword } from "@/lib/password";
import { dbError, int, num, s } from "./helpers";
import type { FormState } from "@/lib/form-defs";
import type { Department, Level, PermAction, PermModel, Scope, TaxonomyKind } from "@/lib/constants";

/**
 * Administration guard. The legacy /roles matrix only scopes Customer/Item/
 * Quotation/User, so admin screens are gated by seniority instead: CHIEF level,
 * or an admin-ish department (FA / SALES ADMIN / ALL).
 */
async function guardAdmin() {
  const session = await getSession();
  if (!session) return { ok: false as const, state: { error: "Sesi berakhir. Silakan login ulang." } };
  const dept = session.department ?? "";
  const isAdmin =
    session.level === "CHIEF" || dept === "FA" || dept === "ALL" || dept.includes("ADMIN");
  if (!isAdmin) return { ok: false as const, state: { error: "Hanya admin yang dapat mengubah data ini." } };
  return { ok: true as const, session };
}

/* ---------- Users ---------- */

export async function saveUser(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const password = s(fd, "password");
    const values: Record<string, unknown> = {
      email: (s(fd, "email") ?? "").toLowerCase(),
      name: s(fd, "name") ?? "",
      nickname: s(fd, "nickname"),
      department: s(fd, "department"),
      level: s(fd, "level"),
      branchId: int(fd, "branchId"),
      active: fd.get("active") === "1",
    };
    if (!values.email) return { fieldErrors: { email: "Email wajib diisi" } };
    if (!values.name) return { fieldErrors: { name: "Nama wajib diisi" } };
    if (password) values.passwordHash = await hashPassword(password);

    if (id) {
      const [before] = await db.select().from(users).where(eq(users.id, id));
      await db.update(users).set({ ...values, updatedAt: new Date() }).where(eq(users.id, id));
      await recordAudit({ model: "User", recordId: id, event: "update", session: g.session, changes: diff(before, values, ["id", "createdAt", "updatedAt", "legacyId", "passwordHash"]) });
    } else {
      const [row] = await db.insert(users).values(values as typeof users.$inferInsert).returning({ id: users.id });
      await recordAudit({ model: "User", recordId: row.id, event: "create", session: g.session, changes: diff(null, values, ["passwordHash"]) });
    }
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function deleteUser(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/* ---------- Branches ---------- */

export async function saveBranch(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const values = { name: s(fd, "name") ?? "", address: s(fd, "address") };
    if (!values.name) return { fieldErrors: { name: "Nama wajib diisi" } };
    if (id) await db.update(branches).set({ ...values, updatedAt: new Date() }).where(eq(branches.id, id));
    else await db.insert(branches).values(values);
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/admin/branches");
  redirect("/admin/branches");
}

export async function deleteBranch(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(branches).where(eq(branches.id, id));
  revalidatePath("/admin/branches");
  redirect("/admin/branches");
}

/* ---------- Settings (FX rates) ---------- */

export async function saveSetting(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const values = {
      key: s(fd, "key") ?? "",
      valueDecimal: num(fd, "valueDecimal"),
      valueString: s(fd, "valueString"),
    };
    if (!values.key) return { fieldErrors: { key: "Key wajib diisi" } };
    if (id) {
      const [before] = await db.select().from(settings).where(eq(settings.id, id));
      await db.update(settings).set({ ...values, updatedAt: new Date() }).where(eq(settings.id, id));
      await recordAudit({ model: "Setting", recordId: id, event: "update", session: g.session, changes: diff(before, values) });
    } else {
      const [row] = await db.insert(settings).values(values).returning({ id: settings.id });
      await recordAudit({ model: "Setting", recordId: row.id, event: "create", session: g.session, changes: diff(null, values) });
    }
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function deleteSetting(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(settings).where(eq(settings.id, id));
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

/* ---------- Permission rules ---------- */

export async function savePermission(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const values = {
      department: (s(fd, "department") ?? "SALES") as Department,
      levelMin: (s(fd, "levelMin") ?? "STAFF") as Level,
      levelMax: (s(fd, "levelMax") ?? "CHIEF") as Level,
      model: (s(fd, "model") ?? "Quotation") as PermModel,
      action: (s(fd, "action") ?? "index") as PermAction,
      scope: (s(fd, "scope") ?? "SELF") as Scope,
      sourceField: s(fd, "sourceField"),
      destField: s(fd, "destField"),
    };
    if (id) await db.update(permissions).set(values).where(eq(permissions.id, id));
    else await db.insert(permissions).values(values);
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

export async function deletePermission(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(permissions).where(eq(permissions.id, id));
  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

/* ---------- Item brands & taxonomies ---------- */

export async function saveBrand(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const name = s(fd, "name");
    if (!name) return { fieldErrors: { name: "Nama wajib diisi" } };
    if (id) await db.update(itemBrands).set({ name }).where(eq(itemBrands.id, id));
    else await db.insert(itemBrands).values({ name });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/items/brands");
  redirect("/items/brands");
}

export async function deleteBrand(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(itemBrands).where(eq(itemBrands.id, id));
  revalidatePath("/items/brands");
  redirect("/items/brands");
}

export async function saveTaxonomy(id: number | null, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardAdmin();
  if (!g.ok) return g.state;
  try {
    const values = {
      name: s(fd, "name") ?? "",
      kind: (s(fd, "kind") ?? "category") as TaxonomyKind,
      parentId: int(fd, "parentId"),
    };
    if (!values.name) return { fieldErrors: { name: "Nama wajib diisi" } };
    if (id) await db.update(taxonomies).set(values).where(eq(taxonomies.id, id));
    else await db.insert(taxonomies).values(values);
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/items/categories");
  redirect("/items/categories");
}

export async function deleteTaxonomy(id: number): Promise<void> {
  const g = await guardAdmin();
  if (!g.ok) throw new Error(g.state.error);
  await db.delete(taxonomies).where(eq(taxonomies.id, id));
  revalidatePath("/items/categories");
  redirect("/items/categories");
}
