import "server-only";
import { cookies } from "next/headers";
import { getUsers, SESSION_COOKIE, AuthError } from "./users";
export async function getActor(){return getUsers().actor((await cookies()).get(SESSION_COOKIE)?.value);}
export async function requireActor(){const actor=await getActor();if(!actor)throw new AuthError("Silakan masuk dengan akun Google yang terdaftar.",401);return actor;}
