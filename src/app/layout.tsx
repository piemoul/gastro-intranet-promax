import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./workspace.css";
const inter=Inter({subsets:["latin"],display:"swap",variable:"--font-inter"});
export const metadata:Metadata={title:"Intranet | Gastro",description:"Ruang kerja penjualan dan pembelian Gastro",robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="id" className={inter.variable}><body>{children}</body></html>;}
