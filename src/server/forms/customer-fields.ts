import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches, users } from "@/server/db/schema";
import { toOptions, type FieldDef } from "@/lib/form-defs";

export async function customerFields(): Promise<FieldDef[]> {
  const [userRows, branchRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, department: users.department }).from(users).orderBy(asc(users.name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name)),
  ]);

  const S1 = "Identitas";
  const S2 = "Kontak";
  const S3 = "Penanggung Jawab";

  return [
    { name: "custCode", label: "Kode Customer", section: S1, required: true },
    { name: "companyName", label: "Nama Perusahaan", section: S1, span: 2 },
    { name: "brand", label: "Brand / Outlet", section: S1 },
    { name: "groupName", label: "Group", section: S1 },
    { name: "category", label: "Kategori", section: S1, hint: "mis. HT- HOTEL, RS- RESTO" },

    { name: "address", label: "Alamat", type: "textarea", section: S2, span: 3 },
    { name: "picName", label: "Nama PIC", section: S2 },
    { name: "picPhone", label: "Telepon PIC", section: S2 },
    { name: "picEmail", label: "Email PIC", type: "email", section: S2 },

    {
      name: "defaultSalesId",
      label: "Default Sales",
      type: "select",
      options: toOptions(userRows, (u) => `${u.name}${u.department ? ` (${u.department})` : ""}`),
      section: S3,
    },
    { name: "branchId", label: "Branch", type: "select", options: toOptions(branchRows, (b) => b.name), section: S3 },
  ];
}
