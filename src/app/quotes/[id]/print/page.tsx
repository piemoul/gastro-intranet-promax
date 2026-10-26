import Image from "next/image";
import { notFound,redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getStore } from "@/server/store";
import { COMPANIES } from "@/lib/domain";
import { estimateTransaction } from "@/lib/calculations";
import { PrintQuoteButton } from "@/components/print-quote-button";
export const dynamic="force-dynamic";
export default async function QuotePrint({params}:{params:Promise<{id:string}>}){
  const actor=await getActor();if(!actor)redirect("/login");const {id}=await params,draft=await getStore().get(actor,id);
  if(draft.kind!=="SQ"||draft.payload.type!=="transaction")notFound();
  const p=draft.payload,t=estimateTransaction(p),company=COMPANIES.find(c=>c.id===draft.companyId)!,en=p.quoteOptions?.language==="EN",issuer=p.quoteOptions?.issuer;
  const money=(n:number)=>new Intl.NumberFormat(en?"en-US":"id-ID",{style:"currency",currency:p.currency}).format(n);
  const terms=[[en?"Delivery":"Pengiriman",p.sqDetails?.delivery],[en?"Installation":"Instalasi",p.sqDetails?.installation],[en?"Validity":"Masa berlaku",p.sqDetails?.validity],[en?"Warranty":"Garansi",p.sqDetails?.warranty],[en?"Payment":"Pembayaran",p.sqDetails?.payment||p.paymentTerm],["Franco",p.sqDetails?.franco]].filter(([,v])=>v);
  return <main className="quote-paper"><PrintQuoteButton/><header className="quote-letterhead"><Image src="/gastro-logo.webp" alt="Gastro" width={180} height={64} unoptimized/><div><h2>{company.name}</h2>{issuer&&<><p>{issuer.address}</p><p>{issuer.phone} {issuer.email}</p></>}</div></header>
    <h1>{en?"SALES QUOTATION":"PENAWARAN HARGA"}</h1>{draft.status!=="PUBLISHED"&&<div className="quote-draft-watermark">DRAFT INTERNAL · {en?"Not published in Accurate":"Belum diterbitkan di Accurate"}</div>}
    <div className="quote-header-grid"><div><strong>{p.partnerName||"—"}</strong><p>{p.partnerNo}</p><p>{p.sqDetails?.pic?`Attn: ${p.sqDetails.pic}`:""}</p><p>{p.address}</p></div><dl><dt>{en?"Number":"Nomor"}</dt><dd>{draft.publication?.accurateNumber||draft.source?.number||draft.number}</dd><dt>{en?"Date":"Tanggal"}</dt><dd>{p.date}</dd><dt>Sales</dt><dd>{draft.ownerName}</dd><dt>{en?"Currency":"Mata uang"}</dt><dd>{p.currency}</dd></dl></div>
    {p.sqDetails?.subject&&<p><strong>{en?"Subject":"Perihal"}: {p.sqDetails.subject}</strong></p>}{p.quoteOptions?.type&&<p>{p.quoteOptions.type==="PROJECT"?"Project":"Unit Sales"} · {p.inclusiveTax?(en?"Prices include tax":"Harga termasuk pajak"):(en?"Prices exclude tax":"Harga belum termasuk pajak")}</p>}
    <table className="quote-items"><thead><tr><th>#</th><th>{en?"Description / SKU":"Barang / SKU"}</th><th>Qty</th><th>{en?"Unit":"Satuan"}</th><th>{en?"Unit price":"Harga unit"}</th><th>{en?"Discount":"Diskon"}</th><th>{en?"Amount":"Jumlah"}</th></tr></thead><tbody>{p.lines.map((l,i)=><tr key={l.id}><td>{i+1}</td><td><strong>{l.name}</strong><small>{l.itemNo}</small>{l.notes&&<p>{l.notes}</p>}</td><td>{l.quantity}</td><td>{l.unit}</td><td>{money(l.unitPrice)}</td><td>{l.discountPercent}%</td><td>{money(p.inclusiveTax?t.lines[i].total:t.lines[i].total-t.lines[i].tax)}</td></tr>)}</tbody></table>
    <dl className="quote-totals"><dt>{en?"Net amount before tax":"Nilai sebelum pajak"}</dt><dd>{money(t.total-t.tax)}</dd><dt>{en?"Tax":"Pajak"}</dt><dd>{money(t.tax)}</dd><dt><strong>Total</strong></dt><dd><strong>{money(t.total)}</strong></dd></dl>
    {p.quoteOptions?.additionalItems.length? <section><h3>{en?"Included extras":"Tambahan / bonus"}</h3><ul>{p.quoteOptions.additionalItems.map((x,i)=><li key={i}>{x}</li>)}</ul></section>:null}
    {terms.length>0&&<section><h3>{en?"Terms and conditions":"Ketentuan penawaran"}</h3><dl className="quote-terms">{terms.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}{p.description&&<p className="quote-notes">{p.description}</p>}
    <footer><p>{en?"Prepared by":"Disiapkan oleh"}: {draft.ownerName}</p>{issuer?.footer&&<p>{issuer.footer}</p>}<small>{draft.status==="PUBLISHED"?`${en?"Accurate quotation":"SQ Accurate"}: ${draft.publication?.accurateNumber||draft.source?.number}`:`${draft.number} · ${en?"Internal draft":"Draft internal"} · v${draft.version}`}</small></footer>
  </main>;
}
