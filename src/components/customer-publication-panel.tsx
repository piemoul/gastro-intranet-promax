"use client";
import { useState } from "react";
import type { Actor,Draft } from "@/lib/domain";
import { COMPANIES } from "@/lib/domain";
import { api,Modal,Notice,post } from "./ui";
export function CustomerPublicationPanel({actor,draft,dirty,onSaved}:{actor:Actor;draft:Draft;dirty:boolean;onSaved:(d:Draft)=>void}){
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[code,setCode]=useState("");
  if(draft.kind!=="CUSTOMER_CREATE"||draft.payload.type!=="customer"||actor.role!=="master_admin")return null;
  const locked=["PUBLISHING","UNCERTAIN"].includes(draft.status),published=draft.status==="PUBLISHED";
  const run=async(action:"publish"|"reconcile")=>{setBusy(true);setError("");try{const r=await post<{draft:Draft}>(`/api/drafts/${draft.id}/${action}`,{version:draft.version,...(action==="publish"?{confirmed:true}:{number:code})});onSaved(r.draft);setConfirm(false);}catch(e){setError((e as Error).message);try{onSaved((await api<{draft:Draft}>(`/api/drafts/${draft.id}`)).draft);}catch{}}finally{setBusy(false);}};
  return <section className="panel action-panel"><h2>{published?"Klien sudah dibuat di Accurate":"Buat klien Accurate"}</h2><p>Khusus Super Admin. Kode yang sudah ada tidak dapat dibuat ulang; master lama tidak diubah.</p>{error&&<Notice error>{error}</Notice>}{draft.publication?.error&&<Notice error>{draft.publication.error}</Notice>}{published?<Notice success>{draft.publication?.accurateNumber} · klien sudah terverifikasi.</Notice>:locked?<><Notice>Hasil pengiriman belum pasti. Pengiriman ulang tetap dikunci sampai rekonsiliasi baca.</Notice><label className="field">Kode klien hasil Accurate<input value={code} onChange={e=>setCode(e.target.value)}/></label><button className="button button-secondary" disabled={busy||!code} onClick={()=>void run("reconcile")}>Periksa klien Accurate</button></>:<button className="button button-primary" disabled={busy||dirty||draft.status!=="APPROVED"} onClick={()=>setConfirm(true)}>Buat klien di Accurate</button>}
    {!published&&!locked&&<p className="fine-print">Simpan, ajukan dan setujui draft sebelum pembuatan klien. Tidak ada saldo awal yang dibuat.</p>}
    {confirm&&<Modal title="Konfirmasi klien baru Accurate" onClose={()=>!busy&&setConfirm(false)}><p>Tambahkan <strong>{draft.payload.name}</strong> ({draft.payload.no}) pada <strong>{COMPANIES.find(c=>c.id===draft.companyId)?.name}</strong>.</p><p>Periksa alamat, kontak dan mata uang. Setelah terbit, data ini hanya dibaca dari Intranet.</p><div className="modal-actions"><button className="button button-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Batal</button><button className="button button-primary" disabled={busy||dirty} onClick={()=>void run("publish")}>{busy?"Mengirim…":"Konfirmasi buat klien"}</button></div></Modal>}
  </section>;
}
