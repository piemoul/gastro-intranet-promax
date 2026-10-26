import { createHmac } from "node:crypto";
import { accurateHost,accurateTimestamp,companyId,type CompanyId } from "./transport";
import { AccurateCreateError } from "./create-transport";
export type NewCustomerBody={customerNo:string;name:string;transDate:string;currencyCode:string;email:string;workPhone:string;billStreet:string;billCity:string;billProvince:string;billCountry:string;billZipCode:string;termName:string;wpNumber:string;description:string;notes:string;branchName:string;categoryName:string;salesmanNumber:string;detailContact:{name:string;email:string;position:string;mobilePhone:string}[]};
const fields=new Set(["customerNo","name","transDate","currencyCode","email","workPhone","billStreet","billCity","billProvince","billCountry","billZipCode","termName","wpNumber","description","notes","branchName","categoryName","salesmanNumber","detailContact"]);
/** Only the customer publication service uses this create-only, single-attempt transport. */
export function createCustomerTransport(config:{host:string;signatureKey:string;tokenForCompany:(id:CompanyId)=>string|undefined;fetchImpl?:typeof fetch}){
  const host=accurateHost(config.host);
  return async(id:number,body:NewCustomerBody):Promise<{id:number;number:string}>=>{
    const token=config.tokenForCompany(companyId(id));if(!token||!config.signatureKey)throw new AccurateCreateError(false,"Koneksi Accurate belum dikonfigurasi.");
    if(Object.keys(body).some(k=>!fields.has(k))||!body.customerNo||!body.name||body.detailContact.some(c=>Object.keys(c).some(k=>!["name","email","position","mobilePhone"].includes(k))))throw new AccurateCreateError(false,"Hanya klien baru tanpa ID, saldo awal atau perubahan master yang diperbolehkan.");
    const timestamp=accurateTimestamp(new Date());let response:Response;
    try{response=await(config.fetchImpl??fetch)(`${host}/accurate/api/customer/save.do`,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${token}`,"X-Api-Timestamp":timestamp,"X-Api-Signature":createHmac("sha256",config.signatureKey).update(timestamp).digest("base64"),"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(Object.fromEntries(Object.entries(body).filter(([,v])=>v!=="")))});}catch{throw new AccurateCreateError(true,"Koneksi terputus. Hasil pembuatan klien belum pasti; pengiriman ulang dikunci.");}
    if([401,403,429].includes(response.status))throw new AccurateCreateError(false,"Accurate menolak akses customer_save atau batas permintaan tercapai. Periksa izin PT aktif.");
    let value:{s?:boolean;r?:unknown;d?:unknown};try{value=await response.json();}catch{throw new AccurateCreateError(true,"Respons klien Accurate belum dapat diverifikasi.");}
    if(response.ok&&value.s===false)throw new AccurateCreateError(false,"Accurate menolak data klien. Periksa kode, cabang, termin dan kelengkapan master.");
    const r=(value.r??value.d) as {id?:unknown;customerNo?:unknown}|undefined;
    if(!response.ok||value.s!==true||!r||!Number.isSafeInteger(r.id)||Number(r.id)<=0||typeof r.customerNo!=="string"||!r.customerNo)throw new AccurateCreateError(true,"Identitas klien belum dapat dipastikan. Gunakan rekonsiliasi baca.");
    return {id:Number(r.id),number:r.customerNo};
  };
}
