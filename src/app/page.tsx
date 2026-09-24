import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { IntranetApp } from "@/components/intranet-app";
export const dynamic="force-dynamic";
export default async function Page(){const actor=await getActor();if(!actor)redirect("/login");return <IntranetApp actor={actor}/>;}
