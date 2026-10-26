import { z } from "zod";
const text=z.string().trim().max(500),note=z.string().trim().max(5000),money=z.number().finite().min(0).max(1e12);
const currency=z.string().regex(/^[A-Z]{3}$/);
const day=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Tanggal tidak valid.");
export const mappingSchema=z.object({wmsId:z.string().min(1).max(100),wmsCode:text.min(1),accurateId:z.number().int().positive(),accurateNo:text.min(1),active:z.boolean(),reason:text.min(3)}).strict();
export const managedItemSchema=z.object({
  accurateId:z.number().int().positive(),accurateNo:text.min(1),name:text.min(1),brand:text,model:text,unit:text,
  active:z.boolean(),currency,tiers:z.array(money.nullable()).length(6),markups:z.array(z.number().finite().min(0).max(10000)).length(6),
  buyPrices:z.array(z.object({id:text.min(1),description:text,price:money,currency}).strict()).max(30),
  multipliers:z.array(z.object({id:text.min(1),description:text,value:z.number().finite().positive().max(10000)}).strict()).max(30),
  selectedBuyPrice:text,selectedMultiplier:text,deliveryCost:money,installationCost:money,costCurrency:currency,
  branchCosts:z.array(z.object({branch:text.min(1),delivery:money,installation:money}).strict()).max(100),
  validFrom:day,validUntil:day,category:text,subCategory:text,series:text,description:note,specification:note,
  dimensions:z.object({width:money,depth:money,height:money,gross: text,volume:money,weight:money,grossWeight:money}).strict(),
  attributes:z.object({gasType:text,electricity:text,gasPower:text,electricPower:text}).strict(),
  supplier:z.object({id:z.number().int().min(0),no:text,name:text,productionMonths:money,deliveryMonths:money,madeIn:text,origin:text}).strict(),
}).strict().refine(p=>new Set(p.buyPrices.map(x=>x.id)).size===p.buyPrices.length&&new Set(p.multipliers.map(x=>x.id)).size===p.multipliers.length,"ID buy price/multiplier harus unik.")
 .refine(p=>new Set(p.branchCosts.map(x=>x.branch)).size===p.branchCosts.length,"Cabang biaya harus unik.")
 .refine(p=>!p.validFrom||!p.validUntil||p.validUntil>=p.validFrom,"Masa berlaku harga tidak valid.");
export type ManagedItem=z.infer<typeof managedItemSchema>;
export const settingsSchema=z.object({
  rates:z.record(currency,z.number().finite().positive().max(1e9)).refine(r=>r.IDR===1,"Kurs IDR harus 1."),
  defaultCurrency:currency,defaultBranch:text,defaultLanguage:z.enum(["ID","EN"]),rounding:z.union([z.literal(0),z.literal(10000)]),
  categories:z.array(text.min(1)).max(100),series:z.array(text.min(1)).max(100),
  terms:z.array(z.object({id:text.min(1),name:text.min(1),language:z.enum(["ID","EN"]),franco:text,delivery:note,installation:note,validity:text,warranty:note,payment:text,notes:note}).strict()).max(100),
  companyAddress:note,companyPhone:text,companyEmail:z.union([z.literal(""),z.email()]),footer:note,
}).strict().refine(p=>new Set(p.terms.map(t=>t.id)).size===p.terms.length,"ID template terms harus unik.");
export type CommercialSettings=z.infer<typeof settingsSchema>;
export const followupSchema=z.object({ownerId:text.min(1),teamId:text.min(1),status:z.enum(["OPEN","SENT","WON","LOST","CANCELLED"]),sentAt:day,nextContact:day,notes:note}).strict();
export type CommercialKind="ITEM"|"SKU_MAP"|"SETTINGS"|"FOLLOWUP";
export function commercialData(kind:CommercialKind,data:unknown){return kind==="ITEM"?managedItemSchema.parse(data):kind==="SKU_MAP"?mappingSchema.parse(data):kind==="SETTINGS"?settingsSchema.parse(data):followupSchema.parse(data);}
export const defaultSettings=():CommercialSettings=>({rates:{IDR:1},defaultCurrency:"IDR",defaultBranch:"",defaultLanguage:"ID",rounding:0,categories:[],series:[],terms:[],companyAddress:"",companyPhone:"",companyEmail:"",footer:""});
export const emptyManagedItem=():ManagedItem=>({accurateId:1,accurateNo:"",name:"",brand:"",model:"",unit:"",active:true,currency:"IDR",tiers:[null,null,null,null,null,null],markups:[15,20,30,40,50,60],buyPrices:[],multipliers:[],selectedBuyPrice:"",selectedMultiplier:"",deliveryCost:0,installationCost:0,costCurrency:"IDR",branchCosts:[],validFrom:"",validUntil:"",category:"",subCategory:"",series:"",description:"",specification:"",dimensions:{width:0,depth:0,height:0,gross:"",volume:0,weight:0,grossWeight:0},attributes:{gasType:"",electricity:"",gasPower:"",electricPower:""},supplier:{id:0,no:"",name:"",productionMonths:0,deliveryMonths:0,madeIn:"",origin:""}});
export function convertPrice(value:number,from:string,to:string,rates:Record<string,number>){
  if(from===to)return boundedMoney(value);
  if(!rates[from]||!rates[to])throw new Error(`Kurs ${from}/${to} belum diatur. Isi kurs per PT terlebih dahulu.`);
  return boundedMoney(value*rates[from]/rates[to]);
}
export function boundedMoney(value:number){if(!Number.isFinite(value)||value<0||value>1e12)throw new Error("Nilai harga di luar batas aman.");return Math.round((value+Number.EPSILON)*100)/100;}
export function itemCost(item:ManagedItem,target:string,rates:Record<string,number>){
  const buy=item.buyPrices.find(b=>b.id===item.selectedBuyPrice),multiplier=item.multipliers.find(m=>m.id===item.selectedMultiplier);
  if(!buy||!multiplier||buy.price<=0)throw new Error("Pilih buy price dan cost multiplier yang aktif pada Manage Items.");
  return convertPrice(buy.price*multiplier.value,buy.currency,target,rates);
}
export function generatedTiers(item:ManagedItem,rates:Record<string,number>){const cost=itemCost(item,item.currency,rates);return item.markups.map(markup=>boundedMoney(cost*(1+markup/100)));}
export type DeliveryMode="ALL"|"DELIVERY"|"INSTALLATION"|"NONE";
export const quoteOptionsSchema=z.object({type:z.enum(["UNIT_SALES","PROJECT"]),language:z.enum(["ID","EN"]),deliveryMode:z.enum(["ALL","DELIVERY","INSTALLATION","NONE"]),rounding:z.union([z.literal(0),z.literal(10000)]),salesAdmin:text,additionalItems:z.array(text).max(50),exceptionReason:note,originDraftId:text.optional(),originNumber:text.optional(),issuer:z.object({address:note,phone:text,email:text,footer:note}).strict().optional(),templateId:text}).strict();
export type QuoteOptions=z.infer<typeof quoteOptionsSchema>;
export const defaultQuoteOptions=():QuoteOptions=>({type:"UNIT_SALES",language:"ID",deliveryMode:"NONE",rounding:0,salesAdmin:"",additionalItems:[],exceptionReason:"",templateId:""});
export const linePricingSchema=z.object({itemKey:z.string().min(1).max(100),version:z.number().int().positive(),tier:z.number().int().min(0).max(5),base:money,delivery:money,installation:money,mode:z.enum(["ALL","DELIVERY","INSTALLATION","NONE"]),currency,rates:z.record(currency,z.number().finite().positive().max(1e9))}).strict();
export function quotedItemPrice(item:ManagedItem,settings:CommercialSettings,options:{tier:number;currency:string;branch:string;mode:DeliveryMode;rounding:0|10000;date:string}){
  if(!item.active||(item.validFrom&&options.date<item.validFrom)||(item.validUntil&&options.date>item.validUntil))throw new Error("Pricebook tidak aktif atau di luar masa berlaku.");
  const tier=item.tiers[options.tier];if(tier==null)throw new Error("Tier yang dipilih belum diisi pada Manage Items.");
  const base=convertPrice(tier,item.currency,options.currency,settings.rates),cost=itemCost(item,options.currency,settings.rates);
  const branch=item.branchCosts.find(b=>b.branch===options.branch);
  const delivery=["ALL","DELIVERY"].includes(options.mode)?convertPrice(branch?.delivery??item.deliveryCost,item.costCurrency,options.currency,settings.rates):0;
  const installation=["ALL","INSTALLATION"].includes(options.mode)?convertPrice(branch?.installation??item.installationCost,item.costCurrency,options.currency,settings.rates):0;
  let price=boundedMoney(base+delivery+installation);
  if(options.rounding){if(options.currency!=="IDR")throw new Error("Pembulatan 10.000 hanya berlaku untuk IDR.");price=Math.round(price/10000)*10000;if(price===0&&base>0)throw new Error("Pembulatan menjadikan harga nol. Nonaktifkan pembulatan untuk barang ini.");}
  return {price,base,delivery,installation,cost,totalCost:boundedMoney(cost+delivery+installation)};
}
