"use client";

import { useState } from "react";
import { Check, LoaderCircle, Pencil, Plus, ShieldCheck } from "lucide-react";
import {
  COMPANIES,
  ROLE_LABELS,
  type CompanyId,
  type Role,
} from "@/lib/domain";
import {
  api,
  Empty,
  Loading,
  Modal,
  Notice,
  PageHeading,
  post,
  SearchField,
  useResource,
} from "./ui";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyIds: CompanyId[];
  active: boolean;
  teamId: string;
};
const regularRoles: Role[] = [
  "sales",
  "head_sales",
  "importer",
  "head_importer",
];
export function UsersView() {
  const [refresh, setRefresh] = useState(0),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<UserRecord | "new" | null>(null);
  const { data, error, loading } = useResource<{
    items: UserRecord[];
    masterAdminEmail: string;
  }>("/api/users", refresh);
  const items = (data?.items || []).filter((u) =>
    [u.name, u.email, ROLE_LABELS[u.role]].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRASI"
        title="Pengguna & hak akses"
        description="Tentukan akun Google yang diizinkan masuk, peran, dan akses perusahaan."
        action={
          <button
            className="button button-primary"
            onClick={() => setEditing("new")}
          >
            <Plus size={18} />
            Tambah pengguna
          </button>
        }
      />
      <div className="approval-info">
        <ShieldCheck size={22} />
        <div>
          <strong>Masuk dengan akun Google yang terdaftar</strong>
          <p>
            Pengguna hanya dapat mengakses perusahaan dan fitur sesuai peran
            yang diberikan.
          </p>
        </div>
      </div>
      <section className="panel list-panel">
        <div className="list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, email, atau peran…"
          />
          <span className="muted text-small">{items.length} pengguna</span>
        </div>
        {error && <Notice error>{error}</Notice>}
        {loading ? (
          <Loading />
        ) : !items.length ? (
          <Empty
            title="Pengguna tidak ditemukan"
            description="Tambahkan akun Google untuk memberi akses ke Intranet."
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Akses perusahaan</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Pengguna">
                      <div className="user-cell">
                        <span className="user-avatar">
                          {user.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Peran">
                      <span className="role-tag">{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td data-label="Perusahaan">
                      <div className="company-tags">
                        {user.companyIds.map((id) => (
                          <span key={id}>
                            {COMPANIES.find((c) => c.id === id)?.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`status ${user.active ? "status-approved" : "status-neutral"}`}
                      >
                        <span />
                        {user.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      {user.role !== "master_admin" ? (
                        <button
                          className="icon-button"
                          aria-label={`Edit ${user.name}`}
                          onClick={() => setEditing(user)}
                        >
                          <Pencil size={16} />
                        </button>
                      ) : (
                        <span
                          className="protected-tag"
                          title="Akun master admin dilindungi"
                        >
                          <ShieldCheck size={18} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <UserForm
          record={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefresh((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
function UserForm({
  record,
  onClose,
  onSaved,
}: {
  record?: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(record?.email || ""),
    [name, setName] = useState(record?.name || ""),
    [role, setRole] = useState<Role>(record?.role || "sales"),
    [companyIds, setCompanyIds] = useState<CompanyId[]>(
      record?.companyIds || [1],
    ),
    [active, setActive] = useState(record?.active ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (record)
        await api(`/api/users/${record.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, role, companyIds, active }),
        });
      else await post("/api/users", { email, name, role, companyIds, active });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={record ? "Edit akses pengguna" : "Tambah pengguna"}
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form-grid user-form">
          <label className="field field-wide">
            <span>Email akun Google *</span>
            <input
              required
              type="email"
              autoComplete="off"
              value={email}
              disabled={!!record || busy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@gmail.com"
            />
            <small>Pengguna harus masuk dengan akun Google yang sama.</small>
          </label>
          <label className="field field-wide">
            <span>Nama pengguna *</span>
            <input
              required
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
            />
          </label>
          <label className="field field-wide">
            <span>Peran *</span>
            <select
              value={role}
              disabled={busy}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {regularRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="company-checkboxes field-wide" disabled={busy}>
            <legend>Akses perusahaan *</legend>
            {COMPANIES.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={companyIds.includes(c.id)}
                  onChange={(e) =>
                    setCompanyIds(
                      e.target.checked
                        ? [...companyIds, c.id]
                        : companyIds.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  <strong>{c.code}</strong>
                  {c.name}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="checkbox-field field-wide">
            <input
              disabled={busy}
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Akun aktif dan dapat masuk</span>
          </label>
        </div>
        {error && <Notice error>{error}</Notice>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className="button button-primary"
            disabled={busy || !companyIds.length}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            Simpan pengguna
          </button>
        </div>
      </form>
    </Modal>
  );
}
