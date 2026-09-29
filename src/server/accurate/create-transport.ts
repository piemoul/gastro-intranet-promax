import { createHmac } from "node:crypto";
import { accurateHost, accurateTimestamp, companyId, type CompanyId } from "./transport";

export class AccurateCreateError extends Error {
  constructor(public readonly uncertain:boolean,message:string) { super(message); this.name="AccurateCreateError"; }
}
/** Narrow create-only transport. No retries, update IDs, bulk saves or arbitrary endpoints. */
export function createOrderTransport(config:{host:string;signatureKey:string;tokenForCompany:(id:CompanyId)=>string|undefined;fetchImpl?:typeof fetch}) {
  const host=accurateHost(config.host);
  return async (id:number,kind:"PO"|"SO"|"SQ",params:Record<string,string>):Promise<{id:number;number:string}> => {
    const token=config.tokenForCompany(companyId(id));
    if (!token || !config.signatureKey) throw new AccurateCreateError(false,"Koneksi Accurate belum dikonfigurasi.");
    if (!["PO","SO","SQ"].includes(kind) || Object.keys(params).some(key=>/(?:^|\.)(?:id|_status)$/.test(key)) || params.number) throw new AccurateCreateError(false,"Permintaan bukan pembuatan SQ/PO/SO baru.");
    const timestamp=accurateTimestamp(new Date());
    let response:Response;
    try {
      response=await (config.fetchImpl??fetch)(`${host}/accurate/api/${kind==="PO"?"purchase-order":kind==="SQ"?"sales-quotation":"sales-order"}/save.do`,{
        method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(25_000),
        headers:{Authorization:`Bearer ${token}`,"X-Api-Timestamp":timestamp,"X-Api-Signature":createHmac("sha256",config.signatureKey).update(timestamp).digest("base64"),"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8",Accept:"application/json"},
        body:new URLSearchParams(params).toString(),
      });
    } catch { throw new AccurateCreateError(true,"Koneksi terputus saat pengiriman. Periksa hasil di Accurate; jangan membuat ulang dokumen."); }
    if ([401,403,429].includes(response.status)) throw new AccurateCreateError(false,response.status===429?"Batas permintaan Accurate tercapai. Coba lagi nanti.":"Accurate menolak akses tulis. Periksa izin sales_quotation_save / sales_order_save / purchase_order_save untuk PT ini.");
    let body:{s?:boolean;d?:unknown;r?:unknown};
    try { body=await response.json(); } catch { throw new AccurateCreateError(true,"Hasil Accurate belum dapat dipastikan. Periksa nomor dokumen di Accurate."); }
    if (response.ok && body?.s===false) throw new AccurateCreateError(false,"Accurate menolak dokumen. Periksa cabang, termin, gudang, pajak, mata uang, dan kelengkapan data sebelum mencoba lagi.");
    if (!response.ok || body?.s!==true) throw new AccurateCreateError(true,"Hasil pengiriman belum dapat dipastikan. Dokumen dikunci untuk mencegah duplikasi.");
    const data=(body.r??body.d) as {id?:unknown;number?:unknown}|undefined;
    if (!data || !Number.isSafeInteger(data.id) || Number(data.id)<=0 || typeof data.number!=="string" || !data.number.trim()) throw new AccurateCreateError(true,"Accurate menerima pengiriman, tetapi identitas dokumen belum tersedia. Periksa nomor dokumen di Accurate.");
    return {id:Number(data.id),number:data.number};
  };
}
