"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-light p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-brand">GASTRO Intranet</h1>
          <p className="mt-1 text-sm text-muted">PT Gastro Gizi Sarana</p>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state.error && <p className="text-sm text-accent">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Masuk…" : "Masuk"}
          </Button>
        </form>
      </div>
    </main>
  );
}
