"use client";
import { useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { COMPANIES, formatMoney, type Actor, type Draft } from "@/lib/domain";
import { estimateTransaction } from "@/lib/calculations";
import { api, Modal, Notice, post } from "./ui";

export function PublicationPanel({draft,actor,dirty,onSaved}:{draft:Draft;actor:Actor;dirty:boolean;onSaved:(draft:Draft)=>void}) {
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[number,setNumber]=useState("");
  if(!["PO","SO","SQ"].includes(draft.kind)||draft.source||draft.quotation&&draft.kind==="SQ"||draft.payload.type!=="transaction")return null;
  const isSQ=draft.kind==="SQ";
  const ready=isSQ?["DRAFT","REVISION","SUBMITTED","APPROVED"].includes(draft.status):draft.status==="APPROVED";
  const missingWarehouse=draft.payload.lines.some(line=>!line.warehouse.trim());
  const allowed=actor.role==="master_admin"||actor.role===(draft.kind==="PO"?"head_importer":"head_sales");
  const canPublish=allowed||(isSQ&&actor.role==="sales"&&actor.userId===draft.ownerId);
  const locked=["PUBLISHING","UNCERTAIN"].includes(draft.status),published=draft.status==="PUBLISHED";
  const company=COMPANIES.find(c=>c.id===draft.companyId)!;
  const run=async(action:"publish"|"reconcile")=>{
    setBusy(true);setError("");
    try {
      const result=await post<{draft:Draft}>(`/api/drafts/${draft.id}/${action}`,{version:draft.version,...(action==="publish"?{confirmed:true}:{number})});
      onSaved(result.draft);setConfirm(false);
    } catch(e) {
      setError((e as Error).message);
      try { const result=await api<{draft:Draft}>(`/api/drafts/${draft.id}`);onSaved(result.draft); } catch { /* Reservation remains durable even if the browser is disconnected. */ }
    } finally {setBusy(false);}
  };
  return <section className="panel action-panel publication-panel">
    <span className="eyebrow">TAHAP AKHIR</span>
    <h2>{published?`${draft.kind} sudah dibuat di Accurate`:`Buat ${draft.kind} Accurate`}</h2>
    {published?<Notice success><ShieldCheck size={18}/><strong>{draft.publication?.accurateNumber}</strong><p>{company.name}. Draft ini sudah terkunci.</p></Notice>:<p>{isSQ?"Simpan SQ lengkap ke Accurate. Kepala sales kemudian memilih SQ yang akan dilanjutkan menjadi SO.":`Setelah disetujui, kepala bagian membuat dokumen pada Accurate ${company.code}.`} Nomor dokumen mengikuti penomoran Accurate.</p>}
    {draft.publication?.error&&!published&&<Notice error>{draft.publication.error}</Notice>}
    {error&&<Notice error>{error}</Notice>}
    {canPublish&&!published&&!locked&&<button className="button button-primary" disabled={busy||dirty||missingWarehouse||!ready} onClick={()=>{setError("");setConfirm(true);}}><Send size={16}/>Buat {draft.kind} Accurate</button>}
    {!published&&!locked&&<p className="fine-print">{missingWarehouse?"Lengkapi gudang setiap baris dan simpan perubahan.":dirty?"Simpan perubahan sebelum mengirim.":!ready?"Selesaikan persetujuan internal untuk membuka tahap ini.":!canPublish?"Menunggu kepala bagian membuat dokumen Accurate.":"Pembuatan dilakukan hanya setelah konfirmasi Anda."}</p>}
    {locked&&<><Notice>Pengiriman sedang diproses atau hasilnya belum pasti. Pengiriman ulang dikunci. Periksa dokumen di Accurate dan masukkan nomor hasilnya di bawah.</Notice>{canPublish&&<><label className="field">Nomor dokumen Accurate<input value={number} disabled={busy} onChange={e=>setNumber(e.target.value)} placeholder={`Nomor ${draft.kind} dari Accurate`}/></label><button className="button button-secondary" disabled={busy||!number.trim()} onClick={()=>void run("reconcile")}>Periksa hasil Accurate</button><button className="button button-secondary" disabled={busy} onClick={async()=>{setError("");try{onSaved((await api<{draft:Draft}>(`/api/drafts/${draft.id}`)).draft);}catch(e){setError((e as Error).message);}}}>Muat ulang status</button></>}</>}
    {confirm&&<Modal title={`Buat ${draft.kind} Accurate`} onClose={()=>!busy&&setConfirm(false)}>
      <p>Dokumen baru akan dibuat di <strong>{company.name}</strong>.</p>
      <dl className="publication-confirm"><dt>Draft</dt><dd>{draft.number}</dd><dt>{draft.kind==="PO"?"Supplier":"Pelanggan"}</dt><dd>{draft.payload.partnerName} · {draft.payload.partnerNo}</dd><dt>Barang</dt><dd>{draft.payload.lines.length} baris</dd><dt>Estimasi total</dt><dd>{formatMoney(estimateTransaction(draft.payload).total,draft.payload.currency)}</dd></dl>
      <p className="fine-print">Periksa rincian sebelum melanjutkan. Setelah terkirim, draft dikunci dan tidak dapat dikembalikan menjadi SQ atau diedit di Intranet.</p>
      {error&&<Notice error>{error}</Notice>}
      <div className="modal-actions"><button className="button button-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Batal</button><button className="button button-primary" disabled={busy||dirty||missingWarehouse||!ready} onClick={()=>void run("publish")}>{busy?"Memproses…":`Konfirmasi buat ${draft.kind}`}</button></div>
    </Modal>}
  </section>;
}
