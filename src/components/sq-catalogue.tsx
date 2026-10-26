"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Box, Plus, Trash2 } from "lucide-react";
import type { DraftPayload, TransactionLine, TransactionPayload } from "@/lib/domain";
import type { WmsItem } from "@/server/integrations/reference-api";
import { api, Loading, Notice, Picker, useResource } from "./ui";

export const emptySqDetails=()=>({subject:"",pic:"",validity:"",delivery:"",installation:"",warranty:"",franco:"",pricingReviewed:false});
type Catalog={items:WmsItem[];brands:string[];models:string[];page:number;hasMore:boolean;fetchedAt:string};
export function SqCatalogue({payload:p,onChange}:{payload:TransactionPayload;onChange:(p:DraftPayload)=>void}){
  const latest=useRef(p);
  useEffect(()=>{latest.current=p;},[p]);
  const [search,setSearch]=useState(""),[query,setQuery]=useState(""),[brand,setBrand]=useState(""),[model,setModel]=useState(""),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [custom,setCustom]=useState(false),[name,setName]=useState(""),[unit,setUnit]=useState("PCS");
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1);},250);return()=>clearTimeout(timer);},[search]);
  const params=new URLSearchParams({search:query,brand,model,page:String(page)});
  const result=useResource<Catalog>(`/api/catalogue/wms?${params}`,refresh);
  const add=async(source:WmsItem)=>{
    setBusy(true);setError("");
    try{
      const {item}=await api<{item:{id:number;no:string;name:string;unit:string}}>(`/api/catalogue/resolve?${new URLSearchParams({code:source.code,wmsId:source.id})}`);
      const line:TransactionLine={id:crypto.randomUUID(),itemId:item.id,itemNo:item.no,name:item.name,unit:item.unit,quantity:1,unitPrice:0,discountPercent:0,taxPercent:0,taxBasePercent:100,warehouse:"",notes:"",entrySource:{kind:"wms",wmsId:source.id,brand:source.brand,model:source.model}};
      const current=latest.current;onChange({...current,lines:[...current.lines,line],sqDetails:{...emptySqDetails(),...current.sqDetails,pricingReviewed:false}});
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <section className="panel form-panel sq-catalogue">
    <div className="form-section-title"><h2>Katalog barang</h2><p>Pilih barang WMS PT aktif dan jumlahnya. Harga dilengkapi saat review admin.</p></div>
    <div className="form-grid catalogue-filters">
      <label className="field field-wide">Cari SKU, nama, brand atau model<input type="search" value={search} placeholder="Cari barang seperti di katalog Gastro…" onChange={e=>setSearch(e.target.value)}/></label>
      <label className="field">Brand<select value={brand} onChange={e=>{setBrand(e.target.value);setModel("");setPage(1);}}><option value="">Semua brand</option>{!result.data&&brand&&<option>{brand}</option>}{result.data?.brands.map(b=><option key={b}>{b}</option>)}</select></label>
      <label className="field">Model<select value={model} disabled={!brand} onChange={e=>{setModel(e.target.value);setPage(1);}}><option value="">Semua model</option>{!result.data&&model&&<option>{model}</option>}{result.data?.models.map(m=><option key={m}>{m}</option>)}</select></label>
      <label className="field field-wide">SKU / barang (hasil pencarian)<select value="" disabled={busy||result.loading||!result.data?.items.length} onChange={e=>{const item=result.data?.items.find(i=>i.id===e.target.value);if(item)void add(item);}}><option value="">Pilih SKU untuk ditambahkan…</option>{result.data?.items.map(i=><option key={i.id} value={i.id}>{i.code} · {i.name} · stok {i.available}</option>)}</select></label>
    </div>
    <div className="catalogue-toolbar"><span className="fine-print">{result.data?`Stok WMS dibaca ${new Date(result.data.fetchedAt).toLocaleTimeString("id-ID")}`:"Memuat sumber WMS…"} · Informasi stok tidak melakukan reservasi.</span><button type="button" className="button button-secondary" onClick={()=>setRefresh(n=>n+1)}>Perbarui stok</button></div>
    {result.loading?<Loading label="Membaca katalog dan stok WMS…"/>:result.error?<Notice error>{result.error}</Notice>:<>
      <div className="catalogue-grid">{result.data?.items.map(item=><CatalogCard key={item.id} item={item} disabled={busy} onAdd={()=>void add(item)}/>)}</div>
      {!result.data?.items.length&&<Notice>Barang belum ditemukan. Ubah pencarian atau gunakan entry custom.</Notice>}
      <div className="catalogue-toolbar"><button type="button" className="button button-secondary" disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>Halaman {page}</span><button type="button" className="button button-secondary" disabled={!result.data?.hasMore||busy} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div>
    </>}
    {error&&<Notice error>{error}</Notice>}
    {busy&&<Loading label="Mencocokkan SKU dengan master Accurate…"/>}
    <button type="button" className="button button-secondary" onClick={()=>setCustom(v=>!v)}><Plus size={16}/>Entry barang custom</button>
    {custom&&<div className="custom-entry form-grid"><label className="field">Nama / spesifikasi custom<input value={name} onChange={e=>setName(e.target.value)} maxLength={500}/></label><label className="field">Satuan<input value={unit} onChange={e=>setUnit(e.target.value)} maxLength={100}/></label><p className="fine-print field-wide">Admin harus memetakan barang custom ke SKU Accurate yang sudah ada sebelum persetujuan.</p><button type="button" disabled={!name.trim()||!unit.trim()} className="button button-secondary" onClick={()=>{onChange({...p,lines:[...p.lines,{id:crypto.randomUUID(),itemId:0,itemNo:"",name:name.trim(),unit:unit.trim(),quantity:1,unitPrice:0,discountPercent:0,taxPercent:0,taxBasePercent:100,warehouse:"",notes:"",entrySource:{kind:"custom",brand:"",model:""}}],sqDetails:{...emptySqDetails(),...p.sqDetails,pricingReviewed:false}});setName("");setCustom(false);}}>Tambahkan custom ke draft</button></div>}
  </section>;
}
function CatalogCard({item,disabled,onAdd}:{item:WmsItem;disabled:boolean;onAdd:()=>void}){
  const [imageFailed,setImageFailed]=useState(false),[details,setDetails]=useState(false);
  const params=new URLSearchParams({brand:item.brand,model:item.model});
  const presentation=useResource<{items:{description:string;specification:Record<string,string>}[]}>(details?`/api/catalogue/presentation?${params}`:null);
  return <article className="catalogue-card">
    <div className="catalogue-image">{imageFailed?<Box size={38}/>:<Image src={`/api/catalogue/image?${params}`} alt={item.name} width={240} height={160} unoptimized onError={()=>setImageFailed(true)}/>}</div>
    <span className="eyebrow">{item.brand} · {item.model}</span><h3>{item.name}</h3><code>{item.code}</code>
    <strong className="stock-available">Tersedia {item.available} {item.unit}</strong>
    <div className="fine-print">{item.stock.length?item.stock.map(s=><div key={s.warehouseId}>{s.warehouse}: {s.available} tersedia · {s.booked} booking</div>):"Belum ada stok fisik WMS"}</div>
    <div className="catalogue-card-actions"><button type="button" className="button button-primary" disabled={disabled} onClick={onAdd}><Plus size={15}/>Pilih barang</button><button type="button" className="button button-quiet" onClick={()=>setDetails(v=>!v)}>Detail katalog</button></div>
    {details&&<div className="fine-print">{presentation.loading?"Membaca katalog Gastro…":presentation.error?presentation.error:presentation.data?.items.length===1?<><p>{presentation.data.items[0].description}</p>{Object.entries(presentation.data.items[0].specification).slice(0,6).map(([k,v])=><p key={k}>{k}: {v}</p>)}</>:"Belum ada padanan brand dan model yang unik pada katalog Gastro."}</div>}
  </article>;
}
export function SalesEntryFields({payload:p,onChange}:{payload:TransactionPayload;onChange:(p:DraftPayload)=>void}){
  const update=(key:keyof TransactionPayload,value:unknown)=>onChange({...p,[key]:value});
  return <>
    <section className="panel form-panel"><h2>Permintaan Sales Quotation</h2><p className="muted">Isi klien, barang dan jumlah. Admin sales atau Super Admin melengkapi harga dan ketentuan.</p><div className="form-grid">
      <Picker label="Klien Accurate *" value={p.partnerName} url="/api/accurate/partners?kind=customer" placeholder="Cari klien PT aktif" onSelect={c=>onChange({...p,partnerId:c.id,partnerNo:c.no||"",partnerName:c.name})}/>
      <label className="field">Tanggal<input type="date" value={p.date} onChange={e=>update("date",e.target.value)}/></label>
      <label className="field">Perihal<input value={p.sqDetails?.subject||""} maxLength={500} onChange={e=>update("sqDetails",{...emptySqDetails(),...p.sqDetails,subject:e.target.value})}/></label>
      <label className="field">PIC klien<input value={p.sqDetails?.pic||""} maxLength={500} onChange={e=>update("sqDetails",{...emptySqDetails(),...p.sqDetails,pic:e.target.value})}/></label>
      <label className="field field-wide">Catatan permintaan<textarea value={p.description} maxLength={5000} onChange={e=>update("description",e.target.value)}/></label>
    </div></section>
    <SqCatalogue payload={p} onChange={onChange}/>
    <section className="panel form-panel"><h2>Barang yang dipilih ({p.lines.length})</h2>{!p.lines.length&&<p>Pilih barang dari katalog di atas.</p>}{p.lines.map(line=><div className="sales-entry-line" key={line.id}><div><strong>{line.name}</strong><small>{line.itemNo||"Custom · menunggu pemetaan admin"}</small></div><label className="field">Jumlah ({line.unit})<input type="number" min="0.000001" step="any" value={line.quantity} onChange={e=>update("lines",p.lines.map(l=>l.id===line.id?{...l,quantity:Number(e.target.value)}:l))}/></label><button type="button" className="icon-button" aria-label={`Hapus ${line.name}`} onClick={()=>update("lines",p.lines.filter(l=>l.id!==line.id))}><Trash2 size={17}/></button></div>)}</section>
  </>;
}
