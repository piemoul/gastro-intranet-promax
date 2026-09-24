"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Box,
  Building2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  formatMoney,
  KIND_LABELS,
  type Actor,
  type AuditEntry,
  type Draft,
  type DraftKind,
} from "@/lib/domain";
import { auditLabel } from "./draft-editor";
import {
  dateText,
  Empty,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Pagination,
  post,
  RowArrow,
  SearchField,
  Status,
  useResource,
} from "./ui";

type Paged<T> = { items: T[]; page: number; pageCount: number; total: number };
type DocumentSummary = {
  id: number;
  number: string;
  date: string;
  partnerName: string;
  status: string;
  total: number;
  currency: string;
};
type ItemSummary = {
  id: number;
  no: string;
  name: string;
  brand: string;
  model: string;
  unit: string;
  itemType: string;
  active: boolean;
};
type CustomerSummary = {
  id: number;
  no: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
};
type OpenDraft = (kind: DraftKind, id?: string) => void;
const isHead = (actor: Actor) =>
  actor.role.startsWith("head_") || String(actor.role) === "master_admin";
export function DraftTable({
  items,
  onOpen,
  emptyAction,
}: {
  items: Draft[];
  onOpen: OpenDraft;
  emptyAction?: React.ReactNode;
}) {
  return !items.length ? (
    <Empty
      title="Belum ada dokumen"
      description="Dokumen yang Anda buat atau perlu ditinjau akan muncul di sini."
      action={emptyAction}
    />
  ) : (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Dokumen</th>
            <th>Pihak / nama</th>
            <th>Status</th>
            <th>Pembuat</th>
            <th>Diperbarui</th>
            <th>
              <span className="sr-only">Buka</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td data-label="Dokumen">
                <button
                  className="document-link"
                  onClick={() => onOpen(d.kind, d.id)}
                >
                  {d.number}
                </button>
                <small>
                  {KIND_LABELS[d.kind]}
                  {d.source ? " · Usulan perubahan" : ""}
                </small>
              </td>
              <td data-label="Pihak / nama">
                <span className="cell-name">
                  {d.payload.type === "transaction"
                    ? d.payload.partnerName || "Belum dipilih"
                    : d.payload.name || "Belum diisi"}
                </span>
                <small>
                  {d.payload.type === "transaction"
                    ? `${d.payload.lines.length} baris barang`
                    : d.payload.no}
                </small>
              </td>
              <td data-label="Status">
                <Status status={d.status} />
              </td>
              <td data-label="Pembuat">{d.ownerName}</td>
              <td data-label="Diperbarui" className="nowrap muted">
                {dateText(d.updatedAt)}
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Buka ${d.number}`}
                  onClick={() => onOpen(d.kind, d.id)}
                >
                  <RowArrow />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Dashboard({
  actor,
  onView,
  onOpen,
  refresh,
}: {
  actor: Actor;
  onView: (view: string) => void;
  onOpen: OpenDraft;
  refresh: number;
}) {
  const { data, error, loading } = useResource<{ items: Draft[] }>(
    "/api/drafts",
    refresh,
  );
  const items = data?.items || [];
  const sales = actor.role === "sales" || actor.role === "head_sales";
  const admin = String(actor.role) === "master_admin";
  const metrics = [
    {
      label: "Draft aktif",
      value: items.filter((d) => d.status === "DRAFT").length,
      icon: FileText,
      tone: "navy",
      description: "Siap Anda lanjutkan",
    },
    {
      label: "Menunggu persetujuan",
      value: items.filter((d) => d.status === "SUBMITTED").length,
      icon: Clock3,
      tone: "amber",
      description: isHead(actor) ? "Perlu ditinjau" : "Dalam peninjauan",
    },
    {
      label: "Perlu revisi",
      value: items.filter((d) => d.status === "REVISION").length,
      icon: RefreshCw,
      tone: "red",
      description: "Perlu ditindaklanjuti",
    },
    {
      label: "Disetujui internal",
      value: items.filter((d) => d.status === "APPROVED").length,
      icon: ShieldCheck,
      tone: "green",
      description: "Belum dikirim ke Accurate",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE INTRANET"
        title={`Selamat datang, ${actor.name.split(" ")[0]}`}
        description="Kelola penawaran, pesanan, dan data utama dalam satu tempat."
        action={
          <div className="today-label">
            {new Date().toLocaleDateString("id-ID", {
              timeZone: "Asia/Jakarta",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="banner-eyebrow">
            <span />
            TERHUBUNG DENGAN ALUR KERJA WMS
          </span>
          <h2>
            Rapi dari penawaran.
            <br />
            Siap untuk operasional.
          </h2>
          <p>
            Susun dokumen dan selesaikan persetujuan tim.
            <br className="desktop-only" /> Data Accurate tersedia untuk dibaca
            sebagai acuan.
          </p>
          <button
            className="button button-white"
            onClick={() => onOpen(sales ? "SQ" : "PO")}
          >
            Buat {sales ? "Sales Quotation" : "Purchase Order"}
            <ArrowRight size={17} />
          </button>
        </div>
        <div
          className="banner-flow"
          aria-label="Alur kerja Intranet menuju WMS"
        >
          <div className="flow-icon">
            <FileText size={26} />
          </div>
          <div className="flow-connector" />
          <div className="flow-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="flow-connector" />
          <div className="flow-icon flow-last">
            <Box size={26} />
          </div>
          <span className="flow-caption">
            DOKUMEN <span>PERSETUJUAN</span> WMS
          </span>
        </div>
      </section>
      {error && <Notice error>{error}</Notice>}
      <div className="metric-grid">
        {metrics.map((m) => (
          <button
            className="metric-card"
            key={m.label}
            onClick={() =>
              onView(
                m.label === "Menunggu persetujuan" && isHead(actor)
                  ? "approvals"
                  : sales
                    ? "SQ"
                    : "PO",
              )
            }
          >
            <div>
              <span className="metric-label">{m.label}</span>
              <span className={`metric-icon metric-${m.tone}`}>
                <m.icon size={19} />
              </span>
            </div>
            <strong>{loading || error ? "—" : m.value}</strong>
            <p>{m.description}</p>
          </button>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Dokumen terbaru</h2>
              <p>Aktivitas internal perusahaan yang sedang aktif.</p>
            </div>
            <button
              className="text-button"
              onClick={() => onView(sales ? "SQ" : "PO")}
            >
              Lihat semua <ArrowRight size={15} />
            </button>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <DraftTable items={items.slice(0, 6)} onOpen={onOpen} />
          )}
        </section>
        <section className="panel shortcut-panel">
          <div className="panel-heading">
            <div>
              <h2>Akses cepat</h2>
              <p>Mulai pekerjaan berikutnya.</p>
            </div>
          </div>
          <div className="shortcut-list">
            {(sales || admin) && (
              <button onClick={() => onOpen("SQ")}>
                <span className="shortcut-icon">
                  <FileText size={19} />
                </span>
                <span>
                  <strong>Buat penawaran</strong>
                  <small>Draft Sales Quotation</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            {(!sales || admin) && (
              <button onClick={() => onOpen("PO")}>
                <span className="shortcut-icon">
                  <ClipboardList size={19} />
                </span>
                <span>
                  <strong>Buat pesanan pembelian</strong>
                  <small>Draft Purchase Order</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
            <button onClick={() => onView("items")}>
              <span className="shortcut-icon">
                <Box size={19} />
              </span>
              <span>
                <strong>Cari master barang</strong>
                <small>Referensi langsung Accurate</small>
              </span>
              <ArrowRight size={16} />
            </button>
            {isHead(actor) && (
              <button onClick={() => onView("approvals")}>
                <span className="shortcut-icon">
                  <ShieldCheck size={19} />
                </span>
                <span>
                  <strong>Tinjau pengajuan</strong>
                  <small>Persetujuan internal tim</small>
                </span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="workspace-note">
            <span className="dot-green" />
            <strong>Tahap hanya baca</strong>
            <p>
              Persetujuan belum menerbitkan dokumen. Accurate tidak berubah.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
export function DocumentsView({
  actor,
  kind,
  onOpen,
  refresh,
}: {
  actor: Actor;
  kind: "PO" | "SQ" | "SO";
  onOpen: OpenDraft;
  refresh: number;
}) {
  const [tab, setTab] = useState("local"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<number | null>(null),
    [reload, setReload] = useState(0);
  const head = isHead(actor);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);
  const { data, error, loading } = useResource<{ items: Draft[] }>(
    tab === "local" ? `/api/drafts?kind=${kind}` : null,
    refresh + reload,
  );
  const remote = useResource<Paged<DocumentSummary>>(
    tab === "accurate"
      ? `/api/accurate/documents?kind=${kind}&page=${page}&search=${encodeURIComponent(debounced)}`
      : null,
    reload,
  );
  const filtered = (data?.items || []).filter(
    (d) =>
      (status === "all" || d.status === status) &&
      [
        d.number,
        d.ownerName,
        d.payload.type === "transaction"
          ? d.payload.partnerName
          : d.payload.name,
      ].some((s) => s.toLowerCase().includes(search.toLowerCase())),
  );
  const create = kind !== "SO";
  return (
    <>
      <PageHeading
        eyebrow={kind === "PO" ? "PEMBELIAN" : "PENJUALAN"}
        title={KIND_LABELS[kind]}
        description={
          kind === "SO"
            ? "Pantau SO dan susun usulan perubahan tanpa mengubah Accurate."
            : kind === "SQ"
              ? "Susun penawaran pelanggan dan ajukan untuk ditinjau kepala sales."
              : "Susun kebutuhan pembelian dan kelola persetujuan internal."
        }
        action={
          create && (
            <button
              className="button button-primary"
              onClick={() => onOpen(kind)}
            >
              <Plus size={18} />
              Buat {kind}
            </button>
          )
        }
      />
      <section className="panel list-panel">
        <div className="list-top">
          <div className="tabs" role="tablist" aria-label="Sumber dokumen">
            <button
              role="tab"
              aria-selected={tab === "local"}
              className={tab === "local" ? "active" : ""}
              onClick={() => {
                setTab("local");
                setSearch("");
              }}
            >
              Draft Intranet <span className="tab-label">Lokal</span>
            </button>
            {head && (
              <button
                role="tab"
                aria-selected={tab === "accurate"}
                className={tab === "accurate" ? "active" : ""}
                onClick={() => {
                  setTab("accurate");
                  setSearch("");
                }}
              >
                Dokumen Accurate <ShieldCheck size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Cari nomor dokumen atau nama…"
          />
          <div className="toolbar-actions">
            {tab === "local" && (
              <div className="select-wrap">
                <Filter size={15} />
                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Semua status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Menunggu persetujuan</option>
                  <option value="REVISION">Perlu revisi</option>
                  <option value="APPROVED">Disetujui internal</option>
                </select>
                <ChevronDown size={14} />
              </div>
            )}
            <button
              className="icon-button"
              aria-label="Muat ulang dokumen"
              onClick={() => setReload((r) => r + 1)}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>
        {tab === "local" ? (
          <>
            {error && (
              <div className="panel-padding">
                <Notice error>{error}</Notice>
              </div>
            )}
            {loading ? (
              <Loading />
            ) : (
              <DraftTable
                items={filtered}
                onOpen={onOpen}
                emptyAction={
                  create && (
                    <button
                      className="button button-secondary"
                      onClick={() => onOpen(kind)}
                    >
                      <Plus size={16} />
                      Buat draft pertama
                    </button>
                  )
                }
              />
            )}
            <div className="list-foot">
              <span>{filtered.length} dokumen internal</span>
              <span>
                <ShieldCheck size={13} />
                Belum diterbitkan ke Accurate
              </span>
            </div>
          </>
        ) : (
          <>
            {remote.error && (
              <div className="panel-padding">
                <Notice error>{remote.error}</Notice>
              </div>
            )}
            {remote.loading ? (
              <Loading label="Membaca dokumen Accurate…" />
            ) : !remote.data?.items.length ? (
              <Empty
                title="Tidak ada dokumen ditemukan"
                description="Coba ubah pencarian atau periksa koneksi Accurate perusahaan ini."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nomor dokumen</th>
                      <th>{kind === "PO" ? "Supplier" : "Pelanggan"}</th>
                      <th>Tanggal</th>
                      <th>Nilai</th>
                      <th>Status Accurate</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {remote.data.items.map((d) => (
                      <tr key={d.id}>
                        <td data-label="Dokumen">
                          <button
                            className="document-link"
                            onClick={() => setSelected(d.id)}
                          >
                            {d.number}
                          </button>
                          <small>{kind} · Accurate</small>
                        </td>
                        <td data-label="Pihak">
                          <span className="cell-name">
                            {d.partnerName || "—"}
                          </span>
                        </td>
                        <td data-label="Tanggal" className="nowrap muted">
                          {dateText(d.date)}
                        </td>
                        <td data-label="Total" className="money">
                          {formatMoney(d.total, d.currency)}
                        </td>
                        <td data-label="Status">
                          <span className="status status-neutral">
                            {d.status || "—"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Detail ${d.number}`}
                            onClick={() => setSelected(d.id)}
                          >
                            <RowArrow />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {remote.data && (
              <Pagination
                page={page}
                pageCount={remote.data.pageCount}
                total={remote.data.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </section>
      {selected !== null && (
        <AccurateDetail
          kind={kind}
          id={selected}
          actor={actor}
          onClose={() => setSelected(null)}
          onOpen={onOpen}
        />
      )}
    </>
  );
}
export function ApprovalsView({
  onOpen,
  refresh,
}: {
  onOpen: OpenDraft;
  refresh: number;
}) {
  const { data, error, loading } = useResource<{ items: Draft[] }>(
    "/api/drafts",
    refresh,
  );
  const [tab, setTab] = useState("SUBMITTED");
  const items = (data?.items || []).filter((d) => d.status === tab);
  return (
    <>
      <PageHeading
        eyebrow="PENGAWASAN TIM"
        title="Persetujuan"
        description="Tinjau isi pengajuan, berikan keputusan, dan catat revisi tim."
      />
      <div className="approval-info">
        <ShieldCheck size={22} />
        <div>
          <strong>Persetujuan berlaku di Intranet</strong>
          <p>
            Dokumen yang disetujui belum diterbitkan ke Accurate pada tahap ini.
          </p>
        </div>
      </div>
      <section className="panel list-panel">
        <div className="list-top">
          <div className="tabs" role="tablist" aria-label="Status pengajuan">
            {[
              { id: "SUBMITTED", label: "Menunggu ditinjau" },
              { id: "REVISION", label: "Perlu revisi" },
              { id: "APPROVED", label: "Disetujui internal" },
            ].map((t) => (
              <button
                role="tab"
                key={t.id}
                aria-selected={tab === t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <span className="count">
                  {(data?.items || []).filter((d) => d.status === t.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        {error && <Notice error>{error}</Notice>}
        {loading ? <Loading /> : <DraftTable items={items} onOpen={onOpen} />}
      </section>
    </>
  );
}
export function MasterView({
  actor,
  customer = false,
  onOpen,
  refresh,
}: {
  actor: Actor;
  customer?: boolean;
  onOpen: OpenDraft;
  refresh: number;
}) {
  const [tab, setTab] = useState("accurate"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<number | null>(null),
    [reload, setReload] = useState(0);
  const editable = customer
    ? actor.role === "head_sales" || String(actor.role) === "master_admin"
    : actor.role === "head_importer" || String(actor.role) === "master_admin";
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);
  const endpoint = customer ? "customers" : "items";
  const remote = useResource<Paged<ItemSummary | CustomerSummary>>(
    tab === "accurate"
      ? `/api/accurate/${endpoint}?page=${page}&search=${encodeURIComponent(debounced)}`
      : null,
    reload,
  );
  const local = useResource<{ items: Draft[] }>(
    tab === "local" ? "/api/drafts" : null,
    refresh + reload,
  );
  const kind = (customer ? "CUSTOMER_CREATE" : "ITEM_CREATE") as DraftKind;
  const title = customer ? "Master Klien" : "Master Barang";
  const proposals = (local.data?.items || []).filter(
    (d) =>
      d.kind.startsWith(customer ? "CUSTOMER" : "ITEM") &&
      [d.number, d.payload.type === "transaction" ? "" : d.payload.name].some(
        (s) => s.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  return (
    <>
      <PageHeading
        eyebrow="DATA UTAMA"
        title={title}
        description={
          customer
            ? "Baca data pelanggan Accurate dan susun usulan penambahan atau perubahan."
            : "Gunakan master barang Accurate sebagai acuan seluruh transaksi."
        }
        action={
          editable && (
            <button
              className="button button-primary"
              onClick={() => onOpen(kind)}
            >
              <Plus size={18} />
              Usulkan {customer ? "klien" : "barang"} baru
            </button>
          )
        }
      />
      <section className="panel list-panel">
        <div className="list-top">
          <div className="tabs" role="tablist" aria-label="Sumber master">
            <button
              role="tab"
              aria-selected={tab === "accurate"}
              className={tab === "accurate" ? "active" : ""}
              onClick={() => setTab("accurate")}
            >
              Data Accurate <ShieldCheck size={14} />
            </button>
            {editable && (
              <button
                role="tab"
                aria-selected={tab === "local"}
                className={tab === "local" ? "active" : ""}
                onClick={() => setTab("local")}
              >
                Usulan Intranet <span className="tab-label">Lokal</span>
              </button>
            )}
          </div>
        </div>
        <div className="list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={
              customer
                ? "Cari kode atau nama pelanggan…"
                : "Cari kode, nama, merek, atau model…"
            }
          />
          <button
            className="icon-button"
            aria-label="Muat ulang master"
            onClick={() => setReload((r) => r + 1)}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {tab === "local" ? (
          <>
            {local.error && <Notice error>{local.error}</Notice>}
            {local.loading ? (
              <Loading />
            ) : (
              <DraftTable items={proposals} onOpen={onOpen} />
            )}
          </>
        ) : (
          <>
            {remote.error && (
              <div className="panel-padding">
                <Notice error>{remote.error}</Notice>
              </div>
            )}
            {remote.loading ? (
              <Loading
                label={`Membaca ${customer ? "pelanggan" : "barang"} Accurate…`}
              />
            ) : !remote.data?.items.length ? (
              <Empty
                title={`Data ${customer ? "pelanggan" : "barang"} tidak ditemukan`}
                description="Coba kata kunci lain atau periksa koneksi Accurate perusahaan aktif."
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{customer ? "Nama klien" : "Nama barang"}</th>
                      <th>{customer ? "Email" : "Merek / model"}</th>
                      <th>{customer ? "Telepon" : "Satuan"}</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {remote.data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-label={customer ? "Klien" : "Barang"}>
                          <button
                            className="document-link item-name"
                            onClick={() => setSelected(item.id)}
                          >
                            {item.name}
                          </button>
                          <small className="mono">{item.no}</small>
                        </td>
                        <td data-label={customer ? "Email" : "Merek / model"}>
                          {"brand" in item ? (
                            <>
                              {item.brand || "—"}
                              <small>{item.model || "—"}</small>
                            </>
                          ) : (
                            item.email || "—"
                          )}
                        </td>
                        <td data-label={customer ? "Telepon" : "Satuan"}>
                          {"unit" in item
                            ? item.unit || "—"
                            : item.phone || "—"}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`status ${item.active ? "status-approved" : "status-neutral"}`}
                          >
                            <span />
                            {item.active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Detail ${item.name}`}
                            onClick={() => setSelected(item.id)}
                          >
                            <RowArrow />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {remote.data && (
              <Pagination
                page={page}
                pageCount={remote.data.pageCount}
                total={remote.data.total}
                onPage={setPage}
              />
            )}
          </>
        )}
      </section>
      {selected !== null && (
        <AccurateDetail
          kind={customer ? "CUSTOMER" : "ITEM"}
          id={selected}
          actor={actor}
          onClose={() => setSelected(null)}
          onOpen={onOpen}
        />
      )}
    </>
  );
}
function AccurateDetail({
  kind,
  id,
  actor,
  onClose,
  onOpen,
}: {
  kind: string;
  id: number;
  actor: Actor;
  onClose: () => void;
  onOpen: OpenDraft;
}) {
  const isItem = kind === "ITEM",
    isCustomer = kind === "CUSTOMER";
  const endpoint = isItem
    ? `items/${id}`
    : isCustomer
      ? `customers/${id}`
      : `documents/${kind}/${id}`;
  const { data, error, loading } = useResource<Record<string, unknown>>(
    `/api/accurate/${endpoint}`,
  );
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const editable =
    String(actor.role) === "master_admin" ||
    (isItem
      ? actor.role === "head_importer"
      : isCustomer
        ? actor.role === "head_sales"
        : isHead(actor));
  const record = (data?.[
    isItem ? "item" : isCustomer ? "customer" : "document"
  ] || null) as Record<string, unknown> | null;
  const text = (value: unknown) =>
    value === null || value === undefined || value === "" ? "—" : String(value);
  const requestId = useRef(crypto.randomUUID());
  const clone = async () => {
    setBusy(true);
    setActionError("");
    try {
      const { draft } = await post<{ draft: Draft }>(
        "/api/drafts/from-accurate",
        { kind, id, requestId: requestId.current },
      );
      onClose();
      onOpen(draft.kind, draft.id);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const header = (record?.header || {}) as Record<string, unknown>;
  const lines = (record?.lines || []) as Array<Record<string, unknown>>;
  const dependencies = (record?.dependencies || []) as Array<{
    kind: string;
    number: string;
  }>;
  return (
    <Modal
      title={
        isItem
          ? "Detail master barang"
          : isCustomer
            ? "Detail master klien"
            : `Detail ${kind} Accurate`
      }
      onClose={onClose}
      wide
    >
      <div className="readonly-inline">
        <ShieldCheck size={17} />
        <span>Data Accurate · hanya baca</span>
      </div>
      {error && <Notice error>{error}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        record && (
          <>
            <div className="detail-title">
              <span className="detail-icon">
                {isItem ? (
                  <Box size={25} />
                ) : isCustomer ? (
                  <Users size={25} />
                ) : (
                  <FileText size={25} />
                )}
              </span>
              <div>
                <h3>{text(record.name || record.number)}</h3>
                <p>{text(record.no || record.partnerName)}</p>
              </div>
            </div>
            {isItem || isCustomer ? (
              <dl className="detail-grid">
                {(isItem
                  ? [
                      ["Kode", record.no],
                      ["Tipe", record.itemType],
                      ["Merek", record.brand],
                      ["Model", record.model],
                      ["Kategori", record.category],
                      ["Satuan", record.unit],
                      [
                        "Harga jual",
                        formatMoney(Number(record.salesPrice) || 0),
                      ],
                      [
                        "Harga beli",
                        formatMoney(Number(record.purchasePrice) || 0),
                      ],
                      [
                        "Nomor seri",
                        record.manageSerial ? "Digunakan" : "Tidak digunakan",
                      ],
                      ["Jenis nomor seri", record.serialType],
                      ["Pajak", record.taxName],
                      ["Status", record.active ? "Aktif" : "Nonaktif"],
                    ]
                  : [
                      ["Kode", record.no],
                      ["Email", record.email],
                      ["Telepon", record.phone],
                      ["Kontak", record.contactName],
                      ["Mata uang", record.currency],
                      ["Termin", record.paymentTerm],
                      ["NPWP", record.taxNumber],
                      ["Status", record.active ? "Aktif" : "Nonaktif"],
                      ["Alamat", record.address],
                    ]
                ).map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{String(label)}</dt>
                    <dd>{text(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <dl className="detail-grid">
                  {[
                    ["Tanggal", dateText(text(record.date))],
                    ["Status", record.status],
                    ["Referensi", header.poNumber],
                    ["Cabang", header.branchName],
                    ["Termin", header.paymentTerm],
                    ["Mata uang", record.currency],
                    ["Pengiriman", header.shipDate],
                    ["Alamat", header.toAddress],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt>{String(label)}</dt>
                      <dd>{text(value)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="detail-section">
                  <h3>Rincian barang</h3>
                  <div className="table-scroll">
                    <table className="data-table detail-table">
                      <thead>
                        <tr>
                          <th>Barang</th>
                          <th>Jumlah</th>
                          <th>Harga</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => (
                          <tr key={index}>
                            <td>
                              <strong>{text(line.name)}</strong>
                              <small>{text(line.itemNo)}</small>
                            </td>
                            <td>
                              {text(line.quantity)} {text(line.unit)}
                            </td>
                            <td className="money">
                              {formatMoney(
                                Number(line.unitPrice) || 0,
                                text(record.currency),
                              )}
                            </td>
                            <td className="money">
                              {formatMoney(
                                Number(line.total) || 0,
                                text(record.currency),
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="detail-total">
                    <span>Total Accurate</span>
                    <strong>
                      {formatMoney(
                        Number(record.total) || 0,
                        text(record.currency),
                      )}
                    </strong>
                  </div>
                </div>
                {dependencies.length > 0 && (
                  <div className="dependency-box">
                    <h3>Dokumen terkait yang ditemukan</h3>
                    {dependencies.map((d, i) => (
                      <p key={i}>
                        {d.kind} · {d.number}
                      </p>
                    ))}
                  </div>
                )}
                <p className="fine-print">
                  Pemeriksaan dependensi belum menyatakan dokumen aman untuk
                  diubah. Tidak ada dokumen Accurate yang diubah atau
                  dibatalkan.
                </p>
              </>
            )}
            {record.description || header.description || record.notes ? (
              <div className="detail-note">
                <strong>Catatan</strong>
                <p>
                  {text(
                    record.description || header.description || record.notes,
                  )}
                </p>
              </div>
            ) : null}
            {actionError && <Notice error>{actionError}</Notice>}
            {editable && (
              <div className="detail-proposal">
                <div>
                  <strong>Perlu mengubah data ini?</strong>
                  <p>
                    Susun usulan lokal untuk ditinjau. Data Accurate tetap sama.
                  </p>
                </div>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void clone()}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Copy size={17} />
                  )}
                  Usulkan perubahan
                </button>
              </div>
            )}
          </>
        )
      )}
    </Modal>
  );
}
export function AuditView({ refresh }: { refresh: number }) {
  const { data, error, loading } = useResource<{ items: AuditEntry[] }>(
    "/api/audit",
    refresh,
  );
  return (
    <>
      <PageHeading
        eyebrow="TRANSPARANSI"
        title="Riwayat aktivitas"
        description="Catatan tindakan pengguna pada dokumen internal perusahaan aktif."
      />
      <section className="panel list-panel">
        {error && <Notice error>{error}</Notice>}
        {loading ? (
          <Loading />
        ) : !data?.items.length ? (
          <Empty
            title="Belum ada aktivitas"
            description="Pembuatan, perubahan, dan keputusan dokumen akan dicatat di sini."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aktivitas</th>
                  <th>Dokumen</th>
                  <th>Pengguna</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Aktivitas">
                      <strong>{auditLabel(a.action)}</strong>
                      {a.reason && <small>{a.reason}</small>}
                    </td>
                    <td data-label="Dokumen">
                      {a.after?.number || a.before?.number || a.draftId}
                    </td>
                    <td data-label="Pengguna">{a.actorName}</td>
                    <td data-label="Waktu" className="muted">
                      {dateText(a.at, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
export function ResearchView() {
  return (
    <>
      <PageHeading
        eyebrow="PANDUAN WORKSPACE"
        title="Alur kerja & akses"
        description="Pembagian peran Intranet, Accurate, dan operasional WMS."
      />
      <div className="guide-grid">
        <section className="panel guide-card">
          <div className="guide-icon">
            <FileText size={23} />
          </div>
          <h2>Penjualan</h2>
          <p>
            Sales menyusun SQ. Kepala sales meninjau, menyetujui internal, lalu
            membuat draft SO yang terhubung.
          </p>
          <div className="guide-flow">
            <span>SQ</span>
            <ArrowRight size={16} />
            <span>Persetujuan</span>
            <ArrowRight size={16} />
            <span>SO internal</span>
          </div>
          <small>
            SO yang telah ada di Accurate hanya dapat dibaca dan diusulkan
            perubahannya.
          </small>
        </section>
        <section className="panel guide-card">
          <div className="guide-icon">
            <ClipboardList size={23} />
          </div>
          <h2>Pembelian</h2>
          <p>
            Importer menyusun PO. Kepala importer meninjau kebutuhan dan
            memberikan persetujuan internal.
          </p>
          <div className="guide-flow">
            <span>Draft PO</span>
            <ArrowRight size={16} />
            <span>Peninjauan</span>
            <ArrowRight size={16} />
            <span>Disetujui</span>
          </div>
          <small>
            Persetujuan belum mengirim PO ke Accurate pada tahap ini.
          </small>
        </section>
        <section className="panel guide-card">
          <div className="guide-icon">
            <Building2 size={23} />
          </div>
          <h2>Satu perusahaan aktif</h2>
          <p>
            Setiap dokumen, master barang, dan pelanggan mengikuti PT yang
            dipilih. Akses tim diperiksa pada setiap permintaan.
          </p>
          <small>
            Ganti perusahaan melalui pemilih di bagian atas. Selesaikan dan
            simpan draft sebelum berpindah.
          </small>
        </section>
        <section className="panel guide-card">
          <div className="guide-icon">
            <ShieldCheck size={23} />
          </div>
          <h2>Accurate hanya baca</h2>
          <p>
            Data Accurate menjadi acuan transaksi. Master barang dan klien baru
            disimpan sebagai usulan lokal dengan riwayat perubahan.
          </p>
          <small>
            WMS tetap menangani pekerjaan gudang, DO dari SO, dan LPB dari PO
            yang telah tersedia di Accurate.
          </small>
        </section>
      </div>
      <section className="panel guide-note">
        <h2>Penyesuaian field perusahaan</h2>
        <p>
          Formulir menyediakan field umum serta field tambahan untuk kebutuhan
          masing-masing PT. Pola pengisian hasil penelitian tetap perlu
          diperiksa terhadap persyaratan API dan proses bisnis sebelum
          penerbitan Accurate diaktifkan.
        </p>
        <p className="fine-print">
          Pada tahap ini tidak ada fungsi penerbitan Accurate. Field usulan
          belum menjamin seluruh persyaratan dokumen produksi telah terpenuhi.
        </p>
      </section>
    </>
  );
}
