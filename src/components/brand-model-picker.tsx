"use client";

import { useEffect, useId, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import type { ItemSummary } from "@/server/accurate/types";
import { api, Loading, Notice } from "./ui";

type Result = { brands: string[]; models: string[]; items: ItemSummary[]; hasMore: boolean };

function Choice({ label, value, options, loading, disabled, onSearch, onChoose }: {
  label: string; value: string; options: string[]; loading: boolean; disabled: boolean;
  onSearch: (query: string) => void; onChoose: (value: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const choose = (option: string) => { onChoose(option); setQuery(""); setOpen(false); setIndex(0); };
  const shown = open && !disabled;
  return <div className="field picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <div className="picker-input">
      <Search size={17} />
      <input id={id} role="combobox" autoComplete="off" aria-expanded={shown} aria-controls={`${id}-options`}
        aria-autocomplete="list" aria-busy={loading} aria-activedescendant={shown && options[index] ? `${id}-${index}` : undefined}
        disabled={disabled} value={open ? query : value} placeholder={value || `Ketik atau pilih ${label.toLowerCase()}…`}
        onFocus={() => { setQuery(""); setOpen(true); setIndex(0); }}
        onChange={event => { const q = event.target.value; setQuery(q); setOpen(true); setIndex(0); onSearch(q); }}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setIndex(i => Math.max(0, Math.min(options.length - 1, i + (event.key === "ArrowDown" ? 1 : -1)))); }
          if (event.key === "Enter") { event.preventDefault(); if (shown && !loading && options[index]) choose(options[index]); }
        }} />
    </div>
    {shown && <div className="picker-options" id={`${id}-options`} role="listbox" aria-label={label}>
      {loading ? <Loading label="Mencari di Accurate…" /> : !options.length ? <p>Ketik minimal 2 karakter. Jika belum ditemukan, perjelas pencarian atau buka halaman berikutnya.</p> : options.map((option, i) =>
        <button type="button" id={`${id}-${i}`} key={option} role="option" aria-selected={i === index}
          className={i === index ? "selected" : ""} onMouseEnter={() => setIndex(i)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
          <strong>{option}</strong><ArrowRight size={15} />
        </button>)}
    </div>}
  </div>;
}

export function BrandModelPicker({ onSelect, disabled = false }: { onSelect: (item: ItemSummary) => void; disabled?: boolean }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: Result; error?: string } | null>(null);
  const search = query.trim() || model || brand;
  const key = JSON.stringify([search, brand, model, page, retry]);
  const current = result?.key === key ? result : null;
  const loading = search.length >= 2 && !current;
  useEffect(() => {
    if (search.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search, brand, model, page: String(page) });
        const data = await api<Result>(`/api/accurate/item-options?${params}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResult({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: (error as Error).message });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, brand, model, page, retry, key]);
  const reset = () => { setBrand(""); setModel(""); setQuery(""); setPage(1); };
  return <div className="brand-model-picker">
    <div className="form-grid">
      <Choice label="Brand" value={brand} options={current?.data?.brands || []} loading={loading} disabled={disabled}
        onSearch={value => { if (brand) setModel(""); setBrand(""); setQuery(value); setPage(1); }}
        onChoose={value => { setBrand(value); setQuery(model || value); setPage(1); }} />
      <Choice label="Model" value={model} options={current?.data?.models || []} loading={loading} disabled={disabled}
        onSearch={value => { setModel(""); setQuery(value); setPage(1); }}
        onChoose={value => { setModel(value); setQuery(value); setPage(1); }} />
    </div>
    <div className="brand-model-help"><p>Pilih brand dan model dari master Accurate PT aktif, lalu pilih SKU barang. Brand atau model dapat dicari lebih dahulu.</p>
      {(brand || model || query) && <button type="button" className="button button-quiet" disabled={disabled} onClick={reset}><X size={14} />Reset pilihan</button>}
    </div>
    {current?.error && <Notice error>{current.error} <button type="button" className="button button-quiet" onClick={() => setRetry(i => i + 1)}>Coba lagi</button></Notice>}
    {loading && <Loading label="Mencari brand dan model di Accurate…" />}
    {brand && model && current?.data && <div className="brand-model-results">
      <strong>Pilih SKU barang · {brand} / {model}</strong>
      {current.data.items.map(item => <button type="button" key={item.id} disabled={disabled} onClick={() => onSelect(item)} className="brand-model-item">
        <span><strong>{item.no} · {item.name}</strong><small>{item.brand} / {item.model} · {item.unit || "Satuan belum tersedia"}</small></span><ArrowRight size={18} />
      </button>)}
      {!current.data.items.length && <p className="muted">Tidak ada SKU yang cocok pada halaman ini. Perjelas model atau buka halaman berikutnya.</p>}
    </div>}
    {(page > 1 || current?.data?.hasMore) && <div className="brand-model-pages">
      <button type="button" className="button button-secondary" disabled={disabled || loading || page === 1} onClick={() => setPage(i => i - 1)}>Sebelumnya</button>
      <span>Halaman {page}</span>
      <button type="button" className="button button-secondary" disabled={disabled || loading || !current?.data?.hasMore} onClick={() => setPage(i => i + 1)}>Berikutnya</button>
    </div>}
    {current?.data?.hasMore && <p className="muted">Masih ada hasil lain. Perjelas brand/model atau buka halaman berikutnya.</p>}
  </div>;
}
