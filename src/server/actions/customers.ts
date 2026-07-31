"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { customers } from "@/server/db/schema";
import { diff, recordAudit } from "@/server/audit";
import { dbError, guardWrite, int, s } from "./helpers";
import type { FormState } from "@/lib/form-defs";

function customerValues(fd: FormData) {
  return {
    custCode: s(fd, "custCode") ?? "",
    companyName: s(fd, "companyName"),
    brand: s(fd, "brand"),
    groupName: s(fd, "groupName"),
    category: s(fd, "category"),
    address: s(fd, "address"),
    picName: s(fd, "picName"),
    picPhone: s(fd, "picPhone"),
    picEmail: s(fd, "picEmail"),
    defaultSalesId: int(fd, "defaultSalesId"),
    branchId: int(fd, "branchId"),
  };
}

export async function createCustomer(_p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Customer", "create");
  if (!g.ok) return g.state;
  let newId: number;
  try {
    const values = customerValues(fd);
    if (!values.custCode) return { fieldErrors: { custCode: "Kode customer wajib diisi" } };
    const [row] = await db.insert(customers).values(values).returning({ id: customers.id });
    newId = row.id;
    await recordAudit({
      model: "Customer", recordId: newId, event: "create", session: g.session, changes: diff(null, values),
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath("/sales/customers");
  redirect(`/sales/customers/${newId}`);
}

export async function updateCustomer(id: number, _p: FormState, fd: FormData): Promise<FormState> {
  const g = await guardWrite("Customer", "update");
  if (!g.ok) return g.state;
  try {
    const [before] = await db.select().from(customers).where(eq(customers.id, id));
    if (!before) return { error: "Customer tidak ditemukan." };
    const values = { ...customerValues(fd), updatedAt: new Date() };
    if (!values.custCode) return { fieldErrors: { custCode: "Kode customer wajib diisi" } };
    await db.update(customers).set(values).where(eq(customers.id, id));
    await recordAudit({
      model: "Customer", recordId: id, event: "update", session: g.session, changes: diff(before, values),
    });
  } catch (e) {
    return dbError(e);
  }
  revalidatePath(`/sales/customers/${id}`);
  redirect(`/sales/customers/${id}`);
}

export async function deleteCustomer(id: number): Promise<void> {
  const g = await guardWrite("Customer", "destroy");
  if (!g.ok) throw new Error(g.state.error);
  const [before] = await db.select().from(customers).where(eq(customers.id, id));
  await db.delete(customers).where(eq(customers.id, id));
  await recordAudit({
    model: "Customer", recordId: id, event: "destroy", session: g.session,
    changes: [{ field: "cust_code", before: before?.custCode ?? null, after: null }],
  });
  revalidatePath("/sales/customers");
  redirect("/sales/customers");
}
