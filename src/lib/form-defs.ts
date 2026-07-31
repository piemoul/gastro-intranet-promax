/**
 * Declarative field definitions. Long legacy forms (39-field quotation, 65-field
 * item) are described as data and rendered generically by <AutoForm>, instead of
 * hundreds of lines of hand-written JSX.
 */
export type Option = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "checkbox" | "date" | "email" | "password";
  options?: Option[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Grid width in a 3-column section. */
  span?: 1 | 2 | 3;
  section?: string;
};

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

/** Group fields by their `section` (undefined → the given default heading). */
export function groupBySection(fields: FieldDef[], fallback = "Umum"): [string, FieldDef[]][] {
  const map = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const k = f.section ?? fallback;
    const arr = map.get(k);
    if (arr) arr.push(f);
    else map.set(k, [f]);
  }
  return [...map.entries()];
}

/** Build <option> lists from DB rows. */
export function toOptions<T extends { id: number }>(
  rows: T[],
  label: (r: T) => string | null | undefined,
): Option[] {
  return rows.map((r) => ({ value: String(r.id), label: label(r) ?? `#${r.id}` }));
}

export const CURRENCY_OPTIONS: Option[] = [
  "IDR", "USD", "EUR", "SGD", "JPY", "NZD", "GBP", "KRW", "RMB", "SEK",
].map((c) => ({ value: c, label: c }));

export const COMPANY_OPTIONS: Option[] = ["SARANA", "GASTRO", "RSP"].map((c) => ({ value: c, label: c }));

export const QUOTATION_STATUS_OPTIONS: Option[] = ["DRAFT", "SENT", "INTERNAL", "APPROVED", "REJECTED"].map(
  (s) => ({ value: s, label: s }),
);

export const LANG_OPTIONS: Option[] = [
  { value: "ID", label: "Indonesia" },
  { value: "EN", label: "English" },
];
