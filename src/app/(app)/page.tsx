import Link from "next/link";
import { count } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/server/db/client";
import { branches, customers, items, quotations, users } from "@/server/db/schema";

async function rows(table: PgTable): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table);
  return row?.n ?? 0;
}

const CARDS: { label: string; href: string; table: PgTable }[] = [
  { label: "Items", href: "/items", table: items },
  { label: "Customers", href: "/sales/customers", table: customers },
  { label: "Quotations", href: "/sales/quotations", table: quotations },
  { label: "Users", href: "/admin/users", table: users },
  { label: "Branches", href: "/admin/branches", table: branches },
];

export default async function DashboardPage() {
  const stats = await Promise.all(CARDS.map(async (c) => ({ ...c, n: await rows(c.table) })));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">Dashboard</h1>
        <p className="text-sm text-muted">Overview &amp; statistics</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand/40"
          >
            <div className="text-3xl font-bold tabular-nums text-brand">{s.n.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted">
        Data master &amp; transaksi diimpor bertahap dari sistem lama. Angka akan bertambah setelah proses
        scraping.
      </p>
    </div>
  );
}
