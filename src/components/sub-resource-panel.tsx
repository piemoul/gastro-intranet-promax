"use client";
import { useActionState } from "react";
import { Check, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CURRENCY_OPTIONS, type FormState } from "@/lib/form-defs";

export type SubRow = { id: number; label: string; value: string; isDefault: boolean };

/**
 * Generic panel for an item's buy-prices / cost-multipliers: list with
 * "Make Default" + delete, plus an inline add form.
 */
export function SubResourcePanel({
  title,
  rows,
  labelHeader,
  valueHeader,
  withCurrency,
  addAction,
  setDefault,
  remove,
  canEdit,
}: {
  title: string;
  rows: SubRow[];
  labelHeader: string;
  valueHeader: string;
  withCurrency?: boolean;
  addAction: (prev: FormState, fd: FormData) => Promise<FormState>;
  setDefault: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(addAction, {} as FormState);

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand">{title}</h2>

      <Table>
        <THead>
          <TR>
            <TH>{labelHeader}</TH>
            <TH className="text-right">{valueHeader}</TH>
            <TH className="w-32" />
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-4 text-center text-muted">
                Belum ada data.
              </TD>
            </TR>
          )}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium text-brand-dark">
                {r.label}
                {r.isDefault && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    <Star className="size-3" /> DEFAULT
                  </span>
                )}
              </TD>
              <TD className="text-right tabular-nums">{r.value}</TD>
              <TD>
                {canEdit && (
                  <div className="flex items-center justify-end gap-1">
                    {!r.isDefault && (
                      <form action={setDefault.bind(null, r.id)}>
                        <Button type="submit" variant="ghost" size="sm" title="Jadikan default">
                          <Check /> Default
                        </Button>
                      </form>
                    )}
                    <form
                      action={remove.bind(null, r.id)}
                      onSubmit={(e) => {
                        if (!confirm("Hapus baris ini?")) e.preventDefault();
                      }}
                    >
                      <Button type="submit" variant="ghost" size="icon" aria-label="Hapus">
                        <Trash2 className="text-accent" />
                      </Button>
                    </form>
                  </div>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {canEdit && (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            name={withCurrency ? "name" : "description"}
            placeholder={labelHeader}
            className="w-56"
            required
          />
          {withCurrency && (
            <Select name="currency" defaultValue="USD" className="w-28">
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
          <Input
            name={withCurrency ? "price" : "multiplier"}
            placeholder={valueHeader}
            className="w-36"
            inputMode="decimal"
          />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            <Plus /> {pending ? "Menambah…" : "Tambah"}
          </Button>
          {state.error && <p className="w-full text-xs text-accent">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
