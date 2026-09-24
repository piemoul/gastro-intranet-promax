"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  emptyCustomer,
  emptyItem,
  emptyTransaction,
  formatMoney,
  KIND_LABELS,
  type Actor,
  type AuditEntry,
  type Draft,
  type DraftAction,
  type DraftKind,
  type DraftPayload,
  type CustomerPayload,
  type ItemPayload,
  type TransactionLine,
  type TransactionPayload,
} from "@/lib/domain";
import { estimateTransaction } from "@/lib/calculations";
import { identityKey } from "@/lib/item-selection";
import type { ItemSummary } from "@/server/accurate/types";
import { PublicationPanel } from "./publication-panel";
import { BrandModelPicker } from "./brand-model-picker";
import {
  api,
  dateText,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Picker,
  post,
  Status,
  useResource,
} from "./ui";

type EditorProps = {
  actor: Actor;
  kind: DraftKind;
  draftId?: string;
  onBack: () => void;
  onSaved: (draft: Draft) => void;
  onDirtyChange?: (dirty: boolean) => void;
};
export function DraftEditor(props: EditorProps) {
  const { data, error, loading } = useResource<{
    draft: Draft;
    audit: AuditEntry[];
  }>(props.draftId ? `/api/drafts/${props.draftId}` : null);
  if (props.draftId && loading) return <Loading label="Membuka draft…" />;
  if (error)
    return (
      <>
        <button className="button button-quiet" onClick={props.onBack}>
          <ArrowLeft size={16} />
          Kembali
        </button>
        <Notice error>{error}</Notice>
      </>
    );
  return (
    <EditorForm
      key={data?.draft.id || props.kind}
      {...props}
      initial={data?.draft}
      audit={data?.audit || []}
    />
  );
}
function Field({
  label,
  children,
  span = false,
  hint,
}: {
  label: string;
  children: ReactNode;
  span?: boolean;
  hint?: string;
}) {
  return (
    <label className={`field ${span ? "field-wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function EditorForm({
  actor,
  kind,
  onBack,
  onSaved,
  onDirtyChange,
  initial,
  audit,
}: EditorProps & { initial?: Draft; audit: AuditEntry[] }) {
  const [draft, setDraft] = useState<Draft | undefined>(initial),
    [payload, setPayload] = useState<DraftPayload>(
      initial?.payload ||
        (kind.startsWith("ITEM")
          ? emptyItem()
          : kind.startsWith("CUSTOMER")
            ? emptyCustomer()
            : emptyTransaction()),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [dialog, setDialog] = useState<DraftAction | null>(null),
    [reason, setReason] = useState(""),
    [history, setHistory] = useState(audit);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const requestId = useRef(crypto.randomUUID());
  const isHead =
    actor.role.startsWith("head_") || String(actor.role) === "master_admin";
  const activeKind = draft?.kind || kind;
  const publicationLocked = !!draft && ["PUBLISHING", "PUBLISHED", "UNCERTAIN"].includes(draft.status);
  const canEdit = !publicationLocked && (!draft || isHead || ((draft.status === "DRAFT" || draft.status === "REVISION") && draft.ownerId === actor.userId));
  const totals = payload.type === "transaction" ? safeEstimate(payload) : null;
  const missingWarehouses = payload.type === "transaction" && payload.lines.some(line=>!line.warehouse.trim());
  const change = (next: DraftPayload) => {
    setPayload(next);
    setDirty(true);
    setMessage("");
  };
  const updateHistory = async (id: string) => {
    try {
      const result = await api<{ draft: Draft; audit: AuditEntry[] }>(
        `/api/drafts/${id}`,
      );
      setHistory(result.audit);
    } catch {
      /* Existing audited history remains visible if refresh fails. */
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = draft
        ? await api<{ draft: Draft }>(`/api/drafts/${draft.id}`, {
            method: "PUT",
            body: JSON.stringify({ version: draft.version, payload }),
          })
        : await post<{ draft: Draft }>("/api/drafts", {
            kind: activeKind,
            payload,
            requestId: requestId.current,
          });
      setDraft(result.draft);
      setPayload(result.draft.payload);
      setDirty(false);
      setMessage("Draft tersimpan di Intranet. Pembuatan Accurate dilakukan pada tahap akhir.");
      void updateHistory(result.draft.id);
      onSaved(result.draft);
      return result.draft;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const runAction = async (action: DraftAction) => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<{ draft: Draft }>(
        `/api/drafts/${draft.id}/action`,
        { version: draft.version, action, reason },
      );
      setDraft(result.draft);
      setPayload(result.draft.payload);
      setDirty(false);
      setDialog(null);
      setReason("");
      setMessage(
        action === "promote"
          ? "Draft SO internal dibuat dari SQ ini. Belum diterbitkan ke Accurate."
          : action === "demote"
            ? "Draft SQ internal dibuat dari SO ini. Accurate tidak berubah."
            : "Status internal berhasil diperbarui.",
      );
      void updateHistory(result.draft.id);
      onSaved(result.draft);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const actionButton = (
    action: DraftAction,
    label: string,
    primary = false,
  ) => (
    <button
      type="button"
      disabled={busy || dirty || (missingWarehouses && ["submit","approve","promote"].includes(action))}
      className={`button ${primary ? "button-primary" : "button-secondary"}`}
      onClick={() => {
        if (["revise", "demote", "reopen"].includes(action)) {
          setDialog(action);
          setReason("");
        } else void runAction(action);
      }}
    >
      {action === "submit" ? (
        <Send size={16} />
      ) : action === "approve" ? (
        <ShieldCheck size={16} />
      ) : (
        <ArrowRight size={16} />
      )}
      <span>{label}</span>
    </button>
  );
  return (
    <>
      <button
        className="back-link"
        onClick={() => {
          if (
            !dirty ||
            window.confirm(
              "Ada perubahan yang belum disimpan. Tinggalkan formulir?",
            )
          )
            onBack();
        }}
      >
        <ArrowLeft size={16} />
        Kembali ke daftar
      </button>
      <PageHeading
        eyebrow={draft?.source ? "USULAN PERUBAHAN LOKAL" : "DOKUMEN INTERNAL"}
        title={draft?.number || `Buat ${KIND_LABELS[activeKind]}`}
        description={
          draft
            ? `${KIND_LABELS[activeKind]} · ${draft.ownerName} · Versi ${draft.version}`
            : "Susun dokumen, periksa rincian, lalu ajukan untuk persetujuan internal."
        }
        action={draft && <Status status={draft.status} />}
      />
      <div className="editor-layout">
        <div className="editor-main">
          <div className="readonly-inline">
            <ShieldCheck size={18} />
            <span>
              {draft?.source
                ? `Referensi Accurate: ${draft.source.number}. Perubahan disimpan sebagai usulan di Intranet.`
                : "Draft dan persetujuan tersimpan di Intranet. PO/SO dikirim melalui tahap akhir Buat Accurate."}
            </span>
          </div>
          {error && (
            <Notice error>
              {error}
              <span className="notice-sub">
                Input Anda tetap tersimpan di formulir. Jika versi dokumen
                berubah, buka kembali dokumen di tab lain untuk membandingkan
                sebelum mencoba ulang.
              </span>
            </Notice>
          )}
          {message && <Notice success>{message}</Notice>}
          {missingWarehouses && <Notice error>Gudang wajib dipilih pada setiap baris barang sebelum dokumen diajukan, disetujui, atau dibuat di Accurate. Gunakan pilihan gudang per baris atau Terapkan ke semua.</Notice>}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy || !canEdit} className="editor-fields">
              {payload.type === "transaction" ? (
                <TransactionFields
                  kind={activeKind}
                  payload={payload}
                  onChange={change}
                />
              ) : payload.type === "item" ? (
                <ItemFields payload={payload} onChange={change} />
              ) : (
                <CustomerFields payload={payload} onChange={change} />
              )}
            </fieldset>
            <div className="editor-save">
              <span>
                {dirty
                  ? "Ada perubahan yang belum disimpan"
                  : draft
                    ? `Terakhir disimpan ${dateText(draft.updatedAt, true)}`
                    : "Belum disimpan"}
              </span>
              {canEdit && (
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={busy || (!dirty && !!draft)}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  Simpan draft
                </button>
              )}
            </div>
          </form>
        </div>
        <aside className="editor-aside">
          <section className="panel summary-panel">
            <div className="panel-title">
              <FileText size={18} />
              <h2>
                Ringkasan{" "}
                {payload.type !== "transaction" ? "usulan" : "dokumen"}
              </h2>
            </div>
            {payload.type === "transaction" && totals ? (
              <>
                <div className="summary-row">
                  <span>Jumlah baris</span>
                  <strong>{payload.lines.length}</strong>
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>
                    {formatMoney(totals.subtotal, payload.currency)}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Diskon</span>
                  <strong>
                    −{formatMoney(totals.discount, payload.currency)}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Pajak {payload.inclusiveTax ? "(termasuk)" : ""}</span>
                  <strong>{formatMoney(totals.tax, payload.currency)}</strong>
                </div>
                <div className="summary-total">
                  <span>Estimasi total</span>
                  <strong>{formatMoney(totals.total, payload.currency)}</strong>
                </div>
                <p className="fine-print">
                  Perhitungan estimasi. Hasil akhir dapat berbeda sesuai
                  pembulatan dan konfigurasi Accurate.
                </p>
              </>
            ) : (
              <div className="summary-item">
                <strong>
                  {payload.type !== "transaction"
                    ? payload.name || "Nama belum diisi"
                    : "Perhitungan belum tersedia"}
                </strong>
                <small>
                  {payload.type !== "transaction"
                    ? payload.no || "Kode belum diisi"
                    : "Periksa isian angka transaksi."}
                </small>
                <p>
                  Usulan memerlukan pemeriksaan sebelum perubahan dapat
                  diterapkan pada tahap berikutnya.
                </p>
              </div>
            )}
            <div className="local-label">
              <span />
              {draft?.status === "PUBLISHED" ? `Accurate: ${draft.publication?.accurateNumber}` : "Draft tersimpan di Intranet"}
            </div>
          </section>
          {draft && !publicationLocked && (
            <section className="panel action-panel">
              <h2>Alur persetujuan</h2>
              <p>Semua tindakan pada tahap ini berlaku secara internal.</p>
              {dirty && (
                <p className="field-hint">
                  Simpan perubahan sebelum melanjutkan.
                </p>
              )}
              <div className="stack-buttons">
                {["DRAFT", "REVISION"].includes(draft.status) &&
                  canEdit &&
                  actionButton("submit", "Ajukan persetujuan", true)}
                {isHead &&
                  draft.status === "SUBMITTED" &&
                  actionButton("approve", "Setujui internal", true)}
                {isHead &&
                  ["SUBMITTED", "APPROVED"].includes(draft.status) &&
                  actionButton("revise", "Kembalikan untuk revisi")}
                {isHead &&
                  draft.status === "APPROVED" &&
                  draft.kind === "SQ" &&
                  actionButton("promote", "Buat SO internal", true)}
                {isHead &&
                  draft.kind === "SO" &&
                  !draft.source &&
                  actionButton("demote", "Kembalikan menjadi SQ")}
                {isHead &&
                  ["SUBMITTED", "APPROVED"].includes(draft.status) &&
                  actionButton("reopen", "Buka kembali draft")}
              </div>
              {draft.kind === "SO" && draft.source && (
                <p className="fine-print">
                  SO dari Accurate tidak dapat diturunkan menjadi SQ pada tahap
                  hanya baca.
                </p>
              )}
              {!isHead && ["SUBMITTED", "APPROVED"].includes(draft.status) && (
                <div className="pending-box">
                  <ShieldCheck size={20} />
                  <p>
                    {draft.status === "APPROVED"
                      ? "Dokumen telah disetujui secara internal."
                      : "Menunggu pemeriksaan kepala bagian."}
                  </p>
                </div>
              )}
            </section>
          )}
          {draft && <PublicationPanel draft={draft} actor={actor} dirty={dirty || busy} onSaved={next => { setDraft(next); setPayload(next.payload); setDirty(false); void updateHistory(next.id); onSaved(next); }} />}
          {draft && (
            <section className="panel audit-panel">
              <h2>Jejak dokumen</h2>
              <div className="timeline">
                {history.length ? (
                  history
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div className="timeline-entry" key={entry.id}>
                        <span className="timeline-dot" />
                        <strong>{auditLabel(entry.action)}</strong>
                        <p>{entry.actorName}</p>
                        <small>{dateText(entry.at, true)}</small>
                        {entry.reason && (
                          <blockquote>{entry.reason}</blockquote>
                        )}
                      </div>
                    ))
                ) : (
                  <p className="muted">
                    Riwayat akan tersedia setelah dokumen dibuka kembali.
                  </p>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "demote"
              ? "Kembalikan SO internal menjadi SQ"
              : dialog === "reopen"
                ? "Buka kembali draft"
                : "Kembalikan untuk revisi"
          }
          onClose={() => !busy && setDialog(null)}
        >
          <p className="modal-description">
            {dialog === "demote"
              ? "Intranet akan membuat draft SQ yang terhubung dengan SO ini. Dokumen Accurate tidak berubah."
              : "Tulis alasan agar pemilik dokumen dapat menindaklanjuti dengan jelas."}
          </p>
          <Field label="Alasan">
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan bagian yang perlu ditinjau…"
              rows={4}
            />
          </Field>
          {error && <Notice error>{error}</Notice>}
          <div className="modal-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Batal
            </button>
            <button
              className="button button-primary"
              disabled={busy || reason.trim().length < 3}
              onClick={() => void runAction(dialog)}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              Konfirmasi internal
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function TransactionFields({
  kind,
  payload: p,
  onChange,
}: {
  kind: DraftKind;
  payload: TransactionPayload;
  onChange: (p: DraftPayload) => void;
}) {
  const [warehouseRefresh,setWarehouseRefresh]=useState(0);
  const [bulkWarehouse,setBulkWarehouse]=useState("");
  const warehouseOptions=useResource<{items:{id:number;name:string}[]}>("/api/accurate/warehouses",warehouseRefresh);
  const warehouses=warehouseOptions.data?.items||[];
  const latestPayload = useRef(p);
  useEffect(() => {
    latestPayload.current = p;
  }, [p]);
  const [adding, setAdding] = useState(false),
    [error, setError] = useState("");
  const update = (key: keyof TransactionPayload, value: unknown) =>
    onChange({ ...p, [key]: value });
  const lineUpdate = (id: string, key: keyof TransactionLine, value: unknown) =>
    update(
      "lines",
      p.lines.map((line) =>
        line.id === id ? { ...line, [key]: value } : line,
      ),
    );
  const addItem = async (option: ItemSummary) => {
    setAdding(true);
    setError("");
    try {
      const { item } = await api<{
        item: {
          id: number;
          no: string;
          name: string;
          unit: string;
          salesPrice: number;
          purchasePrice: number;
          brand: string;
          model: string;
          active: boolean;
          taxRate?: number;
        };
      }>(`/api/accurate/items/${option.id}`);
      if (!item.active || item.no !== option.no || identityKey(item.brand) !== identityKey(option.brand) || identityKey(item.model) !== identityKey(option.model)) {
        throw new Error("Master barang berubah sejak dipilih. Cari kembali brand dan model di Accurate.");
      }
      onChange({
        ...latestPayload.current,
        lines: [
          ...latestPayload.current.lines,
          {
            id: crypto.randomUUID(),
            itemId: item.id,
            itemNo: item.no,
            name: item.name,
            unit: item.unit || "",
            quantity: 1,
            unitPrice:
              Number(kind === "PO" ? item.purchasePrice : item.salesPrice) || 0,
            discountPercent: 0,
            taxPercent: item.taxRate || 0,
            taxBasePercent: 100,
            warehouse: "",
            notes: "",
          },
        ],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };
  return (
    <>
      <section className="panel form-panel">
        <div className="section-number">01</div>
        <div className="form-section-title">
          <h2>Informasi dokumen</h2>
          <p>Identitas dan pihak yang terkait dengan transaksi.</p>
        </div>
        <div className="form-grid">
          <Picker
            label={kind === "PO" ? "Supplier *" : "Pelanggan *"}
            value={p.partnerName}
            url={`/api/accurate/partners?kind=${kind === "PO" ? "vendor" : "customer"}`}
            placeholder={
              kind === "PO"
                ? "Cari supplier Accurate"
                : "Cari pelanggan Accurate"
            }
            onSelect={(option) =>
              onChange({
                ...p,
                partnerId: option.id,
                partnerNo: option.no || "",
                partnerName: option.name,
              })
            }
          />
          <Field label="Tanggal dokumen *">
            <input
              type="date"
              required
              value={p.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </Field>
          <Field label="Referensi / PO pelanggan">
            <input
              value={p.reference}
              onChange={(e) => update("reference", e.target.value)}
              placeholder="Nomor referensi eksternal"
            />
          </Field>
          <Field label="Mata uang">
            <select
              value={p.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              {Array.from(
                new Set([p.currency, "IDR", "USD", "EUR", "SGD", "CNY", "JPY"]),
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {p.currency !== "IDR" && (
            <Field label="Kurs ke IDR">
              <input
                type="number"
                min="0.000001"
                step="any"
                value={p.exchangeRate}
                onChange={(e) => update("exchangeRate", Number(e.target.value))}
              />
            </Field>
          )}
        </div>
        <details className="advanced-fields">
          <summary>
            Informasi tambahan <ChevronDown size={16} />
          </summary>
          <div className="form-grid">
            <Field label="Cabang">
              <input
                value={p.branch}
                onChange={(e) => update("branch", e.target.value)}
                placeholder="Nama cabang"
              />
            </Field>
            <Field label="Termin pembayaran">
              <input
                value={p.paymentTerm}
                onChange={(e) => update("paymentTerm", e.target.value)}
                placeholder="Sesuai kesepakatan"
              />
            </Field>
            <Field label="Tanggal pengiriman">
              <input
                type="date"
                value={p.shipDate}
                onChange={(e) => update("shipDate", e.target.value)}
              />
            </Field>
            <Field label="Nomor identitas salesperson (SO)">
              <input
                value={p.salesperson}
                onChange={(e) => update("salesperson", e.target.value)}
                placeholder="Nomor salesperson di Accurate"
              />
            </Field>
            <Field label="Alamat pengiriman" span>
              <textarea
                rows={2}
                value={p.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Alamat tujuan pengiriman"
              />
            </Field>
          </div>
          <CustomFields
            fields={p.customFields}
            onChange={(fields) => update("customFields", fields)}
          />
        </details>
      </section>
      <section className="panel form-panel">
        <div className="section-number">02</div>
        <div className="form-section-title">
          <h2>Rincian barang</h2>
          <p>Pilih barang dari master Accurate perusahaan aktif.</p>
        </div>
        <BrandModelPicker
          onSelect={(option) => void addItem(option)}
          disabled={adding}
        />
        {warehouseOptions.error && <Notice error>Daftar gudang belum dapat dimuat. <button type="button" className="button button-secondary" onClick={()=>setWarehouseRefresh(n=>n+1)}>Coba muat gudang lagi</button></Notice>}
        {!warehouseOptions.loading && !warehouseOptions.error && warehouses.length===0 && <Notice>Tidak ada gudang aktif yang tersedia di Accurate PT ini.</Notice>}
        {adding && <Loading label="Mengambil rincian barang…" />}
        {error && <Notice error>{error}</Notice>}
        {p.lines.length > 0 && <div className="bulk-warehouse">
          <Field label="Gudang untuk semua barang" hint="Terapkan ke seluruh baris yang sudah ditambahkan. Gudang per baris tetap bisa diubah.">
            <select value={bulkWarehouse} disabled={warehouseOptions.loading || !!warehouseOptions.error} onChange={e=>setBulkWarehouse(e.target.value)}>
              <option value="">Pilih gudang…</option>
              {warehouses.map(w=><option key={w.id} value={w.name} disabled={warehouses.filter(other=>other.name===w.name).length!==1}>{w.name}</option>)}
            </select>
          </Field>
          <button type="button" className="button button-secondary" disabled={adding || warehouseOptions.loading || !!warehouseOptions.error || warehouses.filter(w=>w.name===bulkWarehouse).length!==1} onClick={()=>update("lines",p.lines.map(line=>({...line,warehouse:bulkWarehouse})))}>Terapkan ke semua ({p.lines.length} baris)</button>
        </div>}
        {!p.lines.length ? (
          <div className="line-empty">
            <Plus size={22} />
            <strong>Belum ada barang</strong>
            <p>Pilih brand, model, lalu SKU di atas untuk menambahkan baris pertama.</p>
          </div>
        ) : (
          <div className="transaction-lines">
            {p.lines.map((line, i) => (
              <div className="transaction-line" key={line.id}>
                <div className="line-heading">
                  <span className="line-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{line.name}</strong>
                    <span>
                      {line.itemNo} <span className="tiny-tag">Accurate</span>
                    </span>
                  </div>
                  <button
                    className="icon-button danger-quiet"
                    type="button"
                    aria-label={`Hapus ${line.name}`}
                    onClick={() =>
                      update(
                        "lines",
                        p.lines.filter((l) => l.id !== line.id),
                      )
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="line-fields">
                  <Field label="Kuantitas">
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        lineUpdate(line.id, "quantity", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Satuan">
                    <input
                      required
                      value={line.unit}
                      onChange={(e) =>
                        lineUpdate(line.id, "unit", e.target.value)
                      }
                    />
                  </Field>
                  <Field label={`Harga (${p.currency})`}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={line.unitPrice}
                      onChange={(e) =>
                        lineUpdate(line.id, "unitPrice", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field label="Diskon %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={line.discountPercent}
                      onChange={(e) =>
                        lineUpdate(
                          line.id,
                          "discountPercent",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label="Pajak %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={line.taxPercent}
                      onChange={(e) =>
                        lineUpdate(
                          line.id,
                          "taxPercent",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field label={kind === "PO" ? "Gudang tujuan (wajib)" : "Gudang pengeluaran (wajib)"} hint="Wajib dipilih dari Accurate PT aktif. Dapat berbeda untuk setiap barang.">
                  <select required aria-required="true" value={line.warehouse} disabled={warehouseOptions.loading || !!warehouseOptions.error} onChange={e=>lineUpdate(line.id,"warehouse",e.target.value)}>
                    <option value="" disabled>{warehouseOptions.loading ? "Memuat gudang…" : "Pilih gudang (wajib)"}</option>
                    {line.warehouse && !warehouses.some(w=>w.name===line.warehouse) && <option value={line.warehouse} disabled>{line.warehouse} — perlu diperiksa</option>}
                    {warehouses.map(w=><option key={w.id} value={w.name} disabled={warehouses.filter(other=>other.name===w.name).length!==1}>{w.name}</option>)}
                  </select>
                </Field>
                <details className="line-details">
                  <summary>
                    Informasi tambahan & catatan baris <ChevronDown size={14} />
                  </summary>
                  <div className="form-grid">
                    <Field label="Dasar pajak (%)">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.taxBasePercent ?? 100}
                        onChange={(e) =>
                          lineUpdate(
                            line.id,
                            "taxBasePercent",
                            Number(e.target.value),
                          )
                        }
                      />
                    </Field>
                    <Field label="Kode proyek Accurate">
                      <input
                        value={line.project || ""}
                        onChange={(e) =>
                          lineUpdate(line.id, "project", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Departemen">
                      <input
                        value={line.department || ""}
                        onChange={(e) =>
                          lineUpdate(line.id, "department", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Catatan baris">
                      <input
                        value={line.notes}
                        onChange={(e) =>
                          lineUpdate(line.id, "notes", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <CustomFields
                    fields={line.customFields || {}}
                    onChange={(fields) =>
                      lineUpdate(line.id, "customFields", fields)
                    }
                  />
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel form-panel">
        <div className="section-number">03</div>
        <div className="form-section-title">
          <h2>Ketentuan & catatan</h2>
          <p>Lengkapi potongan dokumen dan informasi untuk peninjau.</p>
        </div>
        <div className="form-grid">
          <Field label="Diskon dokumen (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              value={p.discountPercent}
              onChange={(e) =>
                update("discountPercent", Number(e.target.value))
              }
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={p.inclusiveTax}
              onChange={(e) => update("inclusiveTax", e.target.checked)}
            />
            <span>Harga sudah termasuk pajak</span>
          </label>
          <Field label="Catatan" span>
            <textarea
              rows={3}
              value={p.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Informasi tambahan untuk dokumen ini…"
            />
          </Field>
        </div>
      </section>
    </>
  );
}
function CustomFields({
  fields,
  onChange,
}: {
  fields: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="custom-fields">
      <h3>Field tambahan perusahaan</h3>
      <p className="fine-print">
        Field tambahan tersimpan di draft. Field yang belum didukung API akan
        ditolak sebelum penerbitan, agar tidak ada data yang hilang.
      </p>
      {Object.entries(fields).map(([key, value]) => (
        <div className="custom-field-row" key={key}>
          <Field label={key}>
            <input
              value={value}
              onChange={(e) => onChange({ ...fields, [key]: e.target.value })}
            />
          </Field>
          <button
            className="icon-button"
            type="button"
            aria-label={`Hapus field ${key}`}
            onClick={() =>
              onChange(
                Object.fromEntries(
                  Object.entries(fields).filter(([k]) => k !== key),
                ),
              )
            }
          >
            <XIcon />
          </button>
        </div>
      ))}
      <div className="custom-add">
        <input
          aria-label="Nama field tambahan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama field tambahan"
        />
        <button
          type="button"
          className="button button-secondary"
          disabled={!name.trim() || name in fields}
          onClick={() => {
            onChange({ ...fields, [name.trim()]: "" });
            setName("");
          }}
        >
          <Plus size={16} />
          Tambah
        </button>
      </div>
    </div>
  );
}
function XIcon() {
  return <Trash2 size={16} />;
}
function ItemFields({
  payload: p,
  onChange,
}: {
  payload: ItemPayload;
  onChange: (p: DraftPayload) => void;
}) {
  const update = (key: keyof ItemPayload, value: unknown) =>
    onChange({ ...p, [key]: value });
  return (
    <>
      <section className="panel form-panel">
        <div className="section-number">01</div>
        <div className="form-section-title">
          <h2>Identitas barang</h2>
          <p>Usulan master barang untuk perusahaan aktif.</p>
        </div>
        <div className="form-grid">
          <Field label="Kode barang *">
            <input
              required
              value={p.no}
              onChange={(e) => update("no", e.target.value)}
              placeholder="Kode unik di Accurate"
            />
          </Field>
          <Field label="Nama barang *">
            <input
              required
              value={p.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Nama lengkap barang"
            />
          </Field>
          <Field label="Tipe barang">
            <select
              value={p.itemType}
              onChange={(e) => update("itemType", e.target.value)}
            >
              <option value="INVENTORY">Persediaan</option>
              <option value="NON_INVENTORY">Non persediaan</option>
              <option value="SERVICE">Jasa</option>
              <option value="GROUP">Grup</option>
              {!["INVENTORY", "NON_INVENTORY", "SERVICE", "GROUP"].includes(
                p.itemType,
              ) && <option>{p.itemType}</option>}
            </select>
          </Field>
          <Field label="Kategori">
            <input
              value={p.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Kategori Accurate"
            />
          </Field>
          <Field label="Merek">
            <input
              value={p.brand}
              onChange={(e) => update("brand", e.target.value)}
              placeholder="Merek barang"
            />
          </Field>
          <Field
            label="Model"
            hint="Mengacu pada field model / charField1 di Accurate."
          >
            <input
              value={p.model}
              onChange={(e) => update("model", e.target.value)}
              placeholder="Model barang"
            />
          </Field>
          <Field label="Satuan utama *">
            <input
              required
              value={p.unit}
              onChange={(e) => update("unit", e.target.value)}
              placeholder="Contoh: UNIT"
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={p.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            <span>Barang aktif</span>
          </label>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="section-number">02</div>
        <div className="form-section-title">
          <h2>Pengaturan barang</h2>
          <p>Harga referensi, nomor seri, dan informasi tambahan.</p>
        </div>
        <div className="form-grid">
          <Field label="Harga jual referensi">
            <input
              type="number"
              min="0"
              step="any"
              value={p.salesPrice}
              onChange={(e) => update("salesPrice", Number(e.target.value))}
            />
          </Field>
          <Field label="Harga beli referensi">
            <input
              type="number"
              min="0"
              step="any"
              value={p.purchasePrice}
              onChange={(e) => update("purchasePrice", Number(e.target.value))}
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={p.manageSN}
              onChange={(e) => update("manageSN", e.target.checked)}
            />
            <span>Menggunakan nomor seri / batch</span>
          </label>
          {p.manageSN && (
            <Field label="Jenis nomor seri">
              <input
                value={p.serialNumberType}
                onChange={(e) => update("serialNumberType", e.target.value)}
                placeholder="Jenis sesuai konfigurasi Accurate"
              />
            </Field>
          )}
          <Field label="Catatan perubahan" span>
            <textarea
              rows={3}
              value={p.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Alasan pembuatan atau perubahan barang…"
            />
          </Field>
        </div>
        <CustomFields
          fields={p.customFields}
          onChange={(fields) => update("customFields", fields)}
        />
      </section>
    </>
  );
}
export function auditLabel(action: string) {
  const labels: Record<string, string> = {
    create: "Draft dibuat",
    update: "Draft diperbarui",
    submit: "Diajukan untuk persetujuan",
    approve: "Disetujui secara internal",
    revise: "Dikembalikan untuk revisi",
    reopen: "Draft dibuka kembali",
    promote: "Draft SQ menjadi SO internal",
    demote: "Draft SO dikembalikan menjadi SQ",
    clone: "Usulan dari Accurate dibuat",
    accurate_reserved: "Pengiriman Accurate dimulai",
    accurate_published: "Dokumen Accurate dibuat",
    accurate_rejected: "Accurate menolak pengiriman",
    accurate_uncertain: "Hasil Accurate perlu diperiksa",
    CREATE: "Draft dibuat",
    UPDATE: "Draft diperbarui",
    SUBMIT: "Diajukan untuk persetujuan",
    APPROVE: "Disetujui secara internal",
    REVISE: "Dikembalikan untuk revisi",
  };
  return labels[action] || action.replaceAll("_", " ");
}

function safeEstimate(payload: TransactionPayload) {
  try {
    return estimateTransaction(payload);
  } catch {
    return null;
  }
}
function CustomerFields({
  payload: p,
  onChange,
}: {
  payload: CustomerPayload;
  onChange: (p: DraftPayload) => void;
}) {
  const update = (key: keyof CustomerPayload, value: unknown) =>
    onChange({ ...p, [key]: value });
  return (
    <>
      <section className="panel form-panel">
        <div className="section-number">01</div>
        <div className="form-section-title">
          <h2>Identitas klien</h2>
          <p>Susun usulan data pelanggan untuk perusahaan aktif.</p>
        </div>
        <div className="form-grid">
          <Field label="Kode klien *">
            <input
              required
              value={p.no}
              onChange={(e) => update("no", e.target.value)}
              placeholder="Kode pelanggan Accurate"
            />
          </Field>
          <Field label="Nama klien *">
            <input
              required
              value={p.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Nama perusahaan / pelanggan"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={p.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Email pelanggan"
            />
          </Field>
          <Field label="Telepon">
            <input
              type="tel"
              value={p.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="Nama kontak">
            <input
              value={p.contactName}
              onChange={(e) => update("contactName", e.target.value)}
            />
          </Field>
          <Field label="NPWP">
            <input
              value={p.taxNumber}
              onChange={(e) => update("taxNumber", e.target.value)}
            />
          </Field>
          <Field label="Alamat" span>
            <textarea
              rows={3}
              value={p.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </Field>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="section-number">02</div>
        <div className="form-section-title">
          <h2>Ketentuan transaksi</h2>
          <p>Informasi referensi untuk dokumen penjualan pelanggan.</p>
        </div>
        <div className="form-grid">
          <Field label="Mata uang">
            <input
              maxLength={3}
              value={p.currency}
              onChange={(e) => update("currency", e.target.value.toUpperCase())}
              placeholder="IDR"
            />
          </Field>
          <Field label="Termin pembayaran">
            <input
              value={p.paymentTerm}
              onChange={(e) => update("paymentTerm", e.target.value)}
              placeholder="Sesuai kesepakatan"
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={p.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            <span>Klien aktif</span>
          </label>
          <Field label="Catatan usulan" span>
            <textarea
              rows={3}
              value={p.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Alasan pembuatan atau perubahan klien…"
            />
          </Field>
        </div>
      </section>
    </>
  );
}
