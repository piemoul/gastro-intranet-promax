import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { DEPARTMENTS, LEVELS, PERM_ACTIONS, PERM_MODELS, SCOPES, TAXONOMY_KINDS } from "@/lib/constants";
import { toOptions, type FieldDef, type Option } from "@/lib/form-defs";

const o = (arr: readonly string[]): Option[] => arr.map((v) => ({ value: v, label: v }));

export async function userFields(): Promise<FieldDef[]> {
  const branchRows = await db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(asc(branches.name));
  return [
    { name: "email", label: "Email", type: "email", required: true },
    { name: "name", label: "Nama", required: true },
    { name: "nickname", label: "Nickname" },
    { name: "department", label: "Departemen", type: "select", options: o(DEPARTMENTS) },
    { name: "level", label: "Level", type: "select", options: o(LEVELS) },
    { name: "branchId", label: "Branch", type: "select", options: toOptions(branchRows, (b) => b.name) },
    { name: "password", label: "Password", type: "password", hint: "Kosongkan agar tidak berubah" },
    { name: "active", label: "Aktif", type: "checkbox" },
  ];
}

export const branchFields: FieldDef[] = [
  { name: "name", label: "Nama Branch", required: true },
  { name: "address", label: "Alamat", type: "textarea", span: 2 },
];

export const settingFields: FieldDef[] = [
  { name: "key", label: "Key", required: true, hint: "mis. CURR_RATE_USD_IDR" },
  { name: "valueDecimal", label: "Nilai (angka)", type: "number" },
  { name: "valueString", label: "Nilai (teks)" },
];

export const permissionFields: FieldDef[] = [
  { name: "department", label: "Departemen", type: "select", options: o(DEPARTMENTS), required: true },
  { name: "levelMin", label: "Level Min", type: "select", options: o(LEVELS), required: true },
  { name: "levelMax", label: "Level Max", type: "select", options: o(LEVELS), required: true },
  { name: "model", label: "Model", type: "select", options: o(PERM_MODELS), required: true },
  { name: "action", label: "Action", type: "select", options: o(PERM_ACTIONS), required: true },
  { name: "scope", label: "Scope", type: "select", options: o(SCOPES), required: true },
  { name: "sourceField", label: "Source Field", hint: "kolom pada user, mis. id" },
  { name: "destField", label: "Dest Field", hint: "kolom pada baris target, mis. sales_id" },
];

export const brandFields: FieldDef[] = [{ name: "name", label: "Nama Brand", required: true }];

export const taxonomyFields: FieldDef[] = [
  { name: "name", label: "Nama", required: true },
  { name: "kind", label: "Jenis", type: "select", options: o(TAXONOMY_KINDS), required: true },
];
