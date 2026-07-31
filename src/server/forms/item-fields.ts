import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { itemBrands, taxonomies } from "@/server/db/schema";
import { CURRENCY_OPTIONS, toOptions, type FieldDef } from "@/lib/form-defs";

export async function itemFields(): Promise<FieldDef[]> {
  const [brandRows, taxRows] = await Promise.all([
    db.select({ id: itemBrands.id, name: itemBrands.name }).from(itemBrands).orderBy(asc(itemBrands.name)),
    db.select({ id: taxonomies.id, name: taxonomies.name, kind: taxonomies.kind }).from(taxonomies).orderBy(asc(taxonomies.name)),
  ]);
  const tax = (kind: string) => toOptions(taxRows.filter((t) => t.kind === kind), (t) => t.name);

  const S1 = "Identitas";
  const S2 = "Klasifikasi";
  const S3 = "Harga Jual";
  const S4 = "Biaya";
  const S5 = "Spesifikasi";

  return [
    { name: "sysId", label: "SYSID", section: S1, required: true, hint: "Kunci bisnis, mis. 04.AJA VCT-25" },
    { name: "model", label: "Model", section: S1 },
    { name: "itemCode", label: "Item Code", section: S1 },
    { name: "brandId", label: "Brand", type: "select", options: toOptions(brandRows, (b) => b.name), section: S1 },
    { name: "sortOrder", label: "Urutan", type: "number", section: S1 },
    { name: "permission", label: "Permission", section: S1 },

    { name: "categoryId", label: "Category", type: "select", options: tax("category"), section: S2 },
    { name: "subCategory1Id", label: "Sub Category 1", type: "select", options: tax("sub_category_1"), section: S2 },
    { name: "subCategory2Id", label: "Sub Category 2", type: "select", options: tax("sub_category_2"), section: S2 },
    { name: "seriesId", label: "Series", type: "select", options: tax("series"), section: S2 },

    { name: "sellPriceCurrency", label: "Mata Uang Jual", type: "select", options: CURRENCY_OPTIONS, section: S3 },
    { name: "sellPriceTier0", label: "Tier 0", type: "number", section: S3 },
    { name: "sellPriceTier1", label: "Tier 1", type: "number", section: S3 },
    { name: "sellPriceTier2", label: "Tier 2", type: "number", section: S3 },
    { name: "sellPriceTier3", label: "Tier 3", type: "number", section: S3 },
    { name: "sellPriceTier4", label: "Tier 4", type: "number", section: S3 },
    { name: "sellPriceTier5", label: "Tier 5", type: "number", section: S3 },

    { name: "defaultCostCurrency", label: "Mata Uang Biaya", type: "select", options: CURRENCY_OPTIONS, section: S4 },
    { name: "defaultDeliveryCost", label: "Biaya Kirim Default", type: "number", section: S4 },

    { name: "description", label: "Deskripsi", type: "textarea", section: S5, span: 3 },
    { name: "keySpecification", label: "Key Specification", type: "textarea", section: S5, span: 3 },
  ];
}
