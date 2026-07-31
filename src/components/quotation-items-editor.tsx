"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/field";
import { CURRENCY_OPTIONS, type FormState } from "@/lib/form-defs";
import { lineResult, type FxSnapshot } from "@/lib/pricing";
import type { Currency } from "@/lib/constants";
import { idr } from "@/lib/format";

export type LineRow = {
  key: string;
  itemId: string;
  itemLabel: string;
  qty: string;
  currency: string;
  price: string;
  deliveryCost: string;
  installCost: string;
  remarks: string;
};
export type ExtraRow = { key: string; label: string; amount: string };

type SearchHit = {
  id: number;
  sysId: string;
  label: string;
  currency: string | null;
  tiers: (string | null)[];
  deliveryCost: string | null;
};

const blankLine = (i: number): LineRow => ({
  key: `l${i}_${Math.round(performance.now() * 1000)}`,
  itemId: "",
  itemLabel: "",
  qty: "1",
  currency: "IDR",
  price: "",
  deliveryCost: "",
  installCost: "",
  remarks: "",
});

export function QuotationItemsEditor({
  action,
  initialLines,
  initialExtras,
  fx,
  includeDiInPrice,
  roundIdrOption,
  backHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initialLines: Omit<LineRow, "key">[];
  initialExtras: Omit<ExtraRow, "key">[];
  fx: FxSnapshot;
  includeDiInPrice: boolean;
  roundIdrOption: boolean;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const [lines, setLines] = useState<LineRow[]>(
    initialLines.length
      ? initialLines.map((l, i) => ({ ...l, key: `init${i}` }))
      : [blankLine(0)],
  );
  const [extras, setExtras] = useState<ExtraRow[]>(initialExtras.map((x, i) => ({ ...x, key: `x${i}` })));

  const setLine = (key: string, patch: Partial<LineRow>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotals = useMemo(
    () =>
      lines.map((l) => {
        try {
          return lineResult(
            {
              qty: l.qty || 0,
              currency: (l.currency as Currency) || "IDR",
              price: l.price.replace(/,/g, "") || 0,
              deliveryCost: l.deliveryCost.replace(/,/g, "") || 0,
              installCost: l.installCost.replace(/,/g, "") || 0,
            },
            { fx, includeDiInPrice, roundIdrOption },
          ).sellIdr;
        } catch {
          return null;
        }
      }),
    [lines, fx, includeDiInPrice, roundIdrOption],
  );

  const total = useMemo(() => {
    let t = 0;
    for (const s of subtotals) if (s) t += Number(s.toString());
    for (const x of extras) t += Number(x.amount.replace(/,/g, "") || 0);
    return t;
  }, [subtotals, extras]);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md border border-accent/30 bg-accent/5 px-4 py-2 text-sm text-accent">{state.error}</p>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">Items</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((l) => [...l, blankLine(l.length)])}>
            <Plus /> Tambah Item
          </Button>
        </div>

        <div className="space-y-4">
          {lines.map((l, i) => (
            <div key={l.key} className="rounded-md border border-border p-3">
              <input type="hidden" name={`lines[${i}][itemId]`} value={l.itemId} />
              <div className="grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  <ItemPicker
                    value={l.itemLabel}
                    name={`lines[${i}][itemLabel]`}
                    onPick={(hit) =>
                      setLine(l.key, {
                        itemId: String(hit.id),
                        itemLabel: hit.label,
                        currency: hit.currency ?? l.currency,
                        price: (hit.tiers.find(Boolean) ?? "").toString(),
                        deliveryCost: hit.deliveryCost ?? "",
                      })
                    }
                    onText={(t) => setLine(l.key, { itemLabel: t, itemId: "" })}
                  />
                </div>
                <div className="lg:col-span-1">
                  <Input
                    name={`lines[${i}][qty]`}
                    value={l.qty}
                    onChange={(e) => setLine(l.key, { qty: e.target.value })}
                    placeholder="Qty"
                    inputMode="decimal"
                  />
                </div>
                <div className="lg:col-span-2">
                  <Select
                    name={`lines[${i}][currency]`}
                    value={l.currency}
                    onChange={(e) => setLine(l.key, { currency: e.target.value })}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="lg:col-span-3">
                  <Input
                    name={`lines[${i}][price]`}
                    value={l.price}
                    onChange={(e) => setLine(l.key, { price: e.target.value })}
                    placeholder="Harga satuan"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-2">
                  <Input
                    name={`lines[${i}][deliveryCost]`}
                    value={l.deliveryCost}
                    onChange={(e) => setLine(l.key, { deliveryCost: e.target.value })}
                    placeholder="Delivery"
                    inputMode="decimal"
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    name={`lines[${i}][installCost]`}
                    value={l.installCost}
                    onChange={(e) => setLine(l.key, { installCost: e.target.value })}
                    placeholder="Install"
                    inputMode="decimal"
                  />
                </div>
                <div className="lg:col-span-5">
                  <Input
                    name={`lines[${i}][remarks]`}
                    value={l.remarks}
                    onChange={(e) => setLine(l.key, { remarks: e.target.value })}
                    placeholder="Remarks"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 lg:col-span-3">
                  <span className="text-sm font-medium tabular-nums text-brand">
                    {subtotals[i] ? idr(subtotals[i]!.toString()) : "—"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus baris"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                  >
                    <Trash2 className="text-accent" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand">Additional Items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExtras((x) => [...x, { key: `x${x.length}_${Date.now()}`, label: "", amount: "" }])}
          >
            <Plus /> Tambah
          </Button>
        </div>
        {extras.length === 0 && <p className="text-sm text-muted">Belum ada item tambahan.</p>}
        <div className="space-y-3">
          {extras.map((x, i) => (
            <div key={x.key} className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <Input
                  name={`extras[${i}][label]`}
                  value={x.label}
                  onChange={(e) =>
                    setExtras((xs) => xs.map((y) => (y.key === x.key ? { ...y, label: e.target.value } : y)))
                  }
                  placeholder="Nama item tambahan"
                />
              </div>
              <div className="lg:col-span-3">
                <Input
                  name={`extras[${i}][amount]`}
                  value={x.amount}
                  onChange={(e) =>
                    setExtras((xs) => xs.map((y) => (y.key === x.key ? { ...y, amount: e.target.value } : y)))
                  }
                  placeholder="Jumlah (IDR)"
                  inputMode="decimal"
                />
              </div>
              <div className="flex items-center lg:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus"
                  onClick={() => setExtras((xs) => xs.filter((y) => y.key !== x.key))}
                >
                  <Trash2 className="text-accent" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between rounded-lg border border-border bg-brand-light px-5 py-4">
        <span className="text-sm font-medium text-brand-dark">Total (exc. PPN)</span>
        <span className="text-xl font-bold tabular-nums text-brand">{idr(String(total))}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Items"}
        </Button>
        <Link href={backHref} className="text-sm text-muted hover:text-brand-dark">
          Batal
        </Link>
      </div>
    </form>
  );
}

/** Type-ahead item search backed by /api/items/search. */
function ItemPicker({
  value,
  name,
  onPick,
  onText,
}: {
  value: string;
  name: string;
  onPick: (hit: SearchHit) => void;
  onText: (t: string) => void;
}) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) return setHits([]);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/items/search?q=${encodeURIComponent(value)}`, { signal: ctl.signal });
        if (r.ok) setHits(await r.json());
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <Input
        name={name}
        value={value}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Ketik nama / SYSID item…"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs hover:bg-brand-light"
                onClick={() => {
                  onPick(h);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-brand">{h.sysId}</span> — {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
