import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { IntranetApp } from "@/components/intranet-app";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{view?:string|string[]}>}){
  const actor=await getActor();if(!actor)redirect("/login");
  const admin=actor.role==="master_admin",sales=admin||["sales","head_sales"].includes(actor.role),imports=admin||["importer","head_importer"].includes(actor.role);
  const views=["dashboard","items","suppliers","audit","research",
    ...(sales?["SQ","SO","reports"]:[]),...(imports?["PO"]:[]),
    ...(admin||actor.role.startsWith("head_")?["approvals","manage-items"]:[]),
    ...(admin||actor.role==="head_sales"?["customers"]:[]),...(admin?["users","commercial-settings"]:[])];
  const requested=(await searchParams).view;
  return <IntranetApp actor={actor} initialView={typeof requested==="string"&&views.includes(requested)?requested:"dashboard"}/>;
}
