"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  X,
  PackageOpen,
} from "lucide-react";
import { STATUS_LABELS, type DraftStatus } from "@/lib/domain";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({
    error: "Respons tidak dapat dibaca. Silakan coba kembali.",
  }));
  if (!response.ok)
    throw new Error(data.error || "Permintaan gagal. Silakan coba kembali.");
  return data as T;
}
export const post = <T,>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });
export function useResource<T>(url: string | null, refresh = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!!url);
  useEffect(() => {
    if (!url) return;
    let active = true;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError("");
        setData(null);
      }
    });
    api<T>(url, { signal: controller.signal })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, refresh]);
  return { data, error, loading };
}
export function dateText(value: string, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
export function Status({ status }: { status: DraftStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      <span />
      {STATUS_LABELS[status]}
    </span>
  );
}
export function Notice({
  children,
  error = false,
  success = false,
}: {
  children: ReactNode;
  error?: boolean;
  success?: boolean;
}) {
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`notice ${error ? "notice-error" : success ? "notice-success" : ""}`}
      role={error ? "alert" : "status"}
    >
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Loading({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="loading">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <PackageOpen size={30} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id="page-title">{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Cari dokumen…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {typeof total === "number"
          ? `${total.toLocaleString("id-ID")} data`
          : `Halaman ${page}`}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Halaman sebelumnya"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {page} / {Math.max(pageCount, 1)}
        </span>
        <button
          className="icon-button"
          aria-label="Halaman berikutnya"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function RowArrow() {
  return <ArrowRight size={17} className="row-arrow" />;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Tutup dialog"
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export type PickerOption = {
  id: number;
  no?: string;
  name: string;
  description?: string;
};
export function Picker({
  label,
  value,
  url,
  onSelect,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  url: string;
  onSelect: (value: PickerOption) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [debounced, setDebounced] = useState(""),
    [index, setIndex] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data, error, loading } = useResource<{ items: PickerOption[] }>(
    open && debounced.trim().length >= 2
      ? `${url}${url.includes("?") ? "&" : "?"}search=${encodeURIComponent(debounced)}`
      : null,
  );
  useEffect(() => {
    function close(e: MouseEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const choose = (option: PickerOption) => {
    onSelect(option);
    setQuery("");
    setOpen(false);
    setIndex(0);
  };
  return (
    <div className="field picker" ref={wrapper}>
      <label>{label}</label>
      <div className="picker-input">
        <Search size={17} />
        <input
          aria-label={label}
          disabled={disabled}
          value={open ? query : value}
          placeholder={value || placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setIndex(0);
          }}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`picker-${label.replace(/\W/g, "")}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, (data?.items.length || 1) - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && open) {
              e.preventDefault();
              if (data?.items[index]) choose(data.items[index]);
            }
          }}
        />
      </div>
      {open && (
        <div
          className="picker-options"
          role="listbox"
          id={`picker-${label.replace(/\W/g, "")}`}
          aria-label={label}
        >
          {query.trim().length < 2 ? (
            <p>Ketik minimal 2 karakter untuk mencari di Accurate.</p>
          ) : loading ? (
            <Loading label="Mencari di Accurate…" />
          ) : error ? (
            <p className="text-error">{error}</p>
          ) : !data?.items.length ? (
            <p>Data tidak ditemukan. Coba nama atau kode lain.</p>
          ) : (
            data.items.map((item, i) => (
              <button
                type="button"
                key={item.id}
                role="option"
                aria-selected={i === index}
                className={i === index ? "selected" : ""}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(item)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.no || `ID ${item.id}`}
                    {item.description ? ` · ${item.description}` : ""}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
