import type { ItemSummary } from "@/server/accurate/types";

export const identityKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
export function itemChoices(items: ItemSummary[], brand: string, model: string) {
  const usable = items.filter(item => item.active && item.id > 0 && item.no && identityKey(item.brand) && identityKey(item.brand) !== "root" && identityKey(item.model));
  const matches = (value: string, selected: string) => !selected || identityKey(value) === identityKey(selected);
  const distinct = (values: string[]) => [...new Map(values.map(value => [identityKey(value), value.trim()])).values()].sort((a, b) => a.localeCompare(b, "id-ID"));
  return {
    brands: distinct(usable.filter(item => matches(item.model, model)).map(item => item.brand)),
    models: distinct(usable.filter(item => matches(item.brand, brand)).map(item => item.model)),
    items: usable.filter(item => matches(item.brand, brand) && matches(item.model, model)),
  };
}
