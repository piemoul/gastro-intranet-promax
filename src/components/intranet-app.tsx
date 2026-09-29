"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Box,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  COMPANIES,
  ROLE_LABELS,
  type Actor,
  type Draft,
  type DraftKind,
} from "@/lib/domain";
import { DraftEditor } from "./draft-editor";
import {
  ApprovalsView,
  AuditView,
  Dashboard,
  DocumentsView,
  MasterView,
  ResearchView,
} from "./record-views";
import { Notice, post } from "./ui";
import { UsersView } from "./users-view";

type NavItem = { id: string; label: string; icon: typeof Box; group: string };
export function IntranetApp({
  actor,
  initialView = "dashboard",
}: {
  actor: Actor;
  initialView?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView),
    [drawer, setDrawer] = useState(false),
    [editor, setEditor] = useState<{ kind: DraftKind; id?: string } | null>(
      null,
    ),
    [editorDirty, setEditorDirty] = useState(false),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const admin = actor.role === "master_admin",
    sales = actor.role === "sales" || actor.role === "head_sales" || admin,
    imports =
      actor.role === "importer" || actor.role === "head_importer" || admin,
    head = actor.role.startsWith("head_") || admin;
  const company = COMPANIES.find((c) => c.id === actor.companyId)!;
  const nav: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      group: "WORKSPACE",
    },
    ...(sales
      ? [
          {
            id: "SQ",
            label: "Sales Quotation",
            icon: FileText,
            group: "PENJUALAN",
          },
          {
            id: "SO",
            label: "Sales Order",
            icon: FileCheck2,
            group: "PENJUALAN",
          },
        ]
      : []),
    ...(imports
      ? [
          {
            id: "PO",
            label: "Purchase Order",
            icon: ClipboardList,
            group: "PEMBELIAN",
          },
        ]
      : []),
    ...(head
      ? [
          {
            id: "approvals",
            label: "Persetujuan",
            icon: ClipboardCheck,
            group: "KELOLA",
          },
        ]
      : []),
    { id: "items", label: "Master Barang", icon: Box, group: "DATA UTAMA" },
    ...(actor.role === "head_sales" || admin
      ? [
          {
            id: "customers",
            label: "Master Klien",
            icon: Users,
            group: "DATA UTAMA",
          },
        ]
      : []),
    {
      id: "audit",
      label: "Riwayat Aktivitas",
      icon: History,
      group: "LAINNYA",
    },
    {
      id: "research",
      label: "Panduan Alur Kerja",
      icon: BookOpen,
      group: "LAINNYA",
    },
    ...(admin
      ? [{ id: "users", label: "Pengguna", icon: Users, group: "ADMINISTRASI" }]
      : []),
  ];
  const activeNav = nav.find((n) => n.id === view) || nav[0];
  const navigate = (next: string) => {
    if (
      editorDirty &&
      !window.confirm(
        "Tutup formulir dan kembali ke daftar? Pastikan perubahan sudah disimpan.",
      )
    )
      return;
    setEditor(null);
    setEditorDirty(false);
    setView(next);
    setDrawer(false);
    setError("");
    window.history.replaceState(null, "", `/?view=${encodeURIComponent(next)}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openDraft = (kind: DraftKind, id?: string) => {
    setEditor({ kind, id });
    setEditorDirty(false);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const saved = (draft: Draft) => {
    setRefresh((r) => r + 1);
    setEditorDirty(false);
    if (editor?.id !== draft.id) setEditor({ kind: draft.kind, id: draft.id });
  };
  useEffect(() => {
    if (drawer) {
      drawerRef.current?.showModal();
      const prior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prior;
      };
    } else {
      drawerRef.current?.close();
    }
  }, [drawer]);
  const changeCompany = async (companyId: number) => {
    if (companyId === actor.companyId) return;
    if (
      editorDirty &&
      !window.confirm(
        "Simpan perubahan sebelum berganti perusahaan. Lanjutkan berpindah?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await post("/api/session/company", { companyId });
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const logout = async () => {
    if (
      editorDirty &&
      !window.confirm(
        "Keluar dari Intranet? Pastikan perubahan sudah disimpan.",
      )
    )
      return;
    setBusy(true);
    try {
      await post("/api/auth/logout", {});
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const navigation = (
    <>
      <div className="sidebar-workspace">
        <span className="eyebrow">PERUSAHAAN AKTIF</span>
        <div className="workspace-name">
          <span className="company-monogram">{company.code}</span>
          <div>
            <strong>{company.shortName}</strong>
            <span>Workspace Intranet</span>
          </div>
        </div>
      </div>
      <nav className="main-nav" aria-label="Navigasi utama">
        {nav.map((item, index) => (
          <div key={item.id}>
            {(index === 0 || nav[index - 1].group !== item.group) && (
              <div className="nav-group-label">{item.group}</div>
            )}
            <button
              className={`nav-link ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-active-dot" />}
            </button>
          </div>
        ))}
      </nav>
    </>
  );
  const profile = (
    <div className="sidebar-profile">
      <span className="profile-avatar">
        {actor.name.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <strong>{actor.name}</strong>
        <span>{ROLE_LABELS[actor.role]}</span>
      </div>
      <button
        className="icon-button"
        aria-label="Keluar dari Intranet"
        disabled={busy}
        onClick={() => void logout()}
      >
        <LogOut size={17} />
      </button>
    </div>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Image
            src="/gastro-logo.webp"
            alt="GASTRO"
            width={166}
            height={84}
            unoptimized
          />
          <span className="brand-divider" />
          <div>
            <strong>
              intranet<span>.</span>
            </strong>
            <small>COMMERCIAL WORKSPACE</small>
          </div>
        </div>
        <div className="sidebar-scroll">{navigation}</div>
        <div className="sidebar-readonly">
          <ShieldCheck size={17} />
          <div>
            <strong>Accurate · terhubung</strong>
            <span>PO/SO setelah persetujuan</span>
          </div>
        </div>
        {profile}
      </aside>
      <header className="topbar">
        <div className="topbar-context">
          <button
            className="icon-button mobile-menu"
            ref={menuRef}
            aria-label="Buka menu navigasi"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Menu size={21} />
          </button>
          <span className="topbar-app">Intranet</span>
          <ChevronRight size={14} className="breadcrumb-chevron" />
          <strong>{editor ? "Draft dokumen" : activeNav.label}</strong>
        </div>
        <div className="topbar-actions">
          <div className="read-only-badge">
            <ShieldCheck size={14} />
            <span>
              Accurate <strong>Terhubung</strong>
            </span>
          </div>
          <div className="company-select">
            <Building2 size={17} />
            <select
              aria-label="Perusahaan aktif"
              disabled={busy}
              value={actor.companyId}
              onChange={(e) => void changeCompany(Number(e.target.value))}
            >
              {COMPANIES.filter((c) => actor.companyIds.includes(c.id)).map(
                (c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ),
              )}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
      </header>
      <div className="mobile-readonly-mode">
        <ShieldCheck size={12} />
        <span>Accurate · Terhubung</span>
        <span>Draft tersimpan di Intranet</span>
      </div>
      <main
        id="main-content"
        ref={mainRef}
        className="main-content"
        aria-labelledby="page-title"
      >
        {error && <Notice error>{error}</Notice>}
        {editor ? (
          <DraftEditor
            actor={actor}
            kind={editor.kind}
            draftId={editor.id}
            onBack={() => {
              setEditor(null);
              setRefresh((r) => r + 1);
            }}
            onDirtyChange={setEditorDirty}
            onSaved={saved}
          />
        ) : view === "dashboard" ? (
          <Dashboard
            actor={actor}
            onView={navigate}
            onOpen={openDraft}
            refresh={refresh}
          />
        ) : view === "PO" || view === "SQ" || view === "SO" ? (
          <DocumentsView
            key={`${actor.companyId}-${view}`}
            actor={actor}
            kind={view}
            onOpen={openDraft}
            refresh={refresh}
          />
        ) : view === "approvals" && head ? (
          <ApprovalsView onOpen={openDraft} refresh={refresh} />
        ) : view === "items" ? (
          <MasterView actor={actor} onOpen={openDraft} refresh={refresh} />
        ) : view === "customers" && (actor.role === "head_sales" || admin) ? (
          <MasterView
            key="customers"
            actor={actor}
            customer
            onOpen={openDraft}
            refresh={refresh}
          />
        ) : view === "audit" ? (
          <AuditView refresh={refresh} />
        ) : view === "users" && admin ? (
          <UsersView />
        ) : (
          <ResearchView />
        )}
        <footer className="page-footer">
          <span>Gastro Intranet</span>
          <span>
            {company.code} <span>·</span> Dokumen lokal & referensi Accurate
          </span>
        </footer>
      </main>
      <dialog
        ref={drawerRef}
        className="mobile-drawer"
        onCancel={(e) => {
          e.preventDefault();
          setDrawer(false);
          menuRef.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawer(false);
        }}
        aria-label="Menu navigasi Intranet"
      >
        <div className="drawer-header">
          <strong>
            intranet<span>.</span>
          </strong>
          <button
            className="icon-button"
            aria-label="Tutup menu"
            onClick={() => {
              setDrawer(false);
              menuRef.current?.focus();
            }}
          >
            <X size={21} />
          </button>
        </div>
        <div className="sidebar-scroll">{navigation}</div>
        {profile}
      </dialog>
    </div>
  );
}
