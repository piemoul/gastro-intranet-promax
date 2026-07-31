"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/lib/password";
import { clearSession, setSession } from "./session";

const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email atau password salah" };
  }

  await setSession({
    uid: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    level: user.level,
    branchId: user.branchId ?? null,
    loginAt: new Date().toISOString(),
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
