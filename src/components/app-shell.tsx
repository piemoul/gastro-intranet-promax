import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Session } from "@/server/auth/session";
import { can } from "@/server/auth/guard";
import { logoutAction } from "@/server/auth/actions";

type NavItem = { label: string; href: string };
type NavGroup = { label: string; href?: string; items?: NavItem[]; show: boolean };

async function buildNav(isAdmin: boolean): Promise<NavGroup[]> {
  const [canItems, canCustomers, canQuotations] = await Promise.all([
    can("Item", "index"),
    can("Customer", "index"),
    can("Quotation", "index"),
  ]);
  return [
    { label: "Home", href: "/", show: true },
    {
      label: "Administration",
      show: isAdmin, // sales users never see this menu
      items: [
        { label: "Users", href: "/admin/users" },
        { label: "Roles", href: "/admin/roles" },
        { label: "Branches", href: "/admin/branches" },
        { label: "Settings", href: "/admin/settings" },
      ],
    },
    {
      label: "Items",
      show: canItems,
      items: [
        { label: "Item Brands", href: "/items/brands" },
        { label: "Item Categories", href: "/items/categories" },
        { label: "Items", href: "/items" },
      ],
    },
    {
      label: "Sales",
      show: canCustomers || canQuotations,
      items: [
        ...(canCustomers ? [{ label: "Customers", href: "/sales/customers" }] : []),
        ...(canQuotations ? [{ label: "Quotations (SQ)", href: "/sales/quotations" }] : []),
        ...(canQuotations && isAdmin ? [{ label: "Approval SO", href: "/sales/approvals" }] : []),
      ],
    },
    {
      label: "Logs",
      show: true,
      items: [
        { label: "Quotation Logs", href: "/logs/quotations" },
        { label: "Customer Logs", href: "/logs/customers" },
      ],
    },
    {
      label: "Reports",
      show: true,
      items: [{ label: "Quotation Report", href: "/reports/quotations" }],
    },
  ];
}

export async function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const nav = (await buildNav(session.isAdmin)).filter((g) => g.show);

  return (
    <>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-brand">PT GASTRO GIZI SARANA</span>
            <span className="hidden text-xs uppercase tracking-wide text-muted sm:inline">
              Commercial Kitchen Equipment
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-brand-dark">{session.name}</span>
            <form action={logoutAction}>
              <button className="text-muted hover:text-accent" type="submit">
                Logout
              </button>
            </form>
          </div>
        </div>
        <nav className="bg-brand-dark">
          <ul className="mx-auto flex max-w-7xl items-stretch px-2 text-sm text-white/90">
            {nav.map((g) => (
              <li key={g.label} className="group relative">
                {g.href ? (
                  <Link href={g.href} className="flex h-11 items-center px-4 hover:bg-white/10">
                    {g.label}
                  </Link>
                ) : (
                  <span className="flex h-11 cursor-default items-center gap-1 px-4 hover:bg-white/10">
                    {g.label}
                    <ChevronDown className="size-3.5 opacity-70" />
                  </span>
                )}
                {g.items && g.items.length > 0 && (
                  <ul className="invisible absolute left-0 top-full z-10 min-w-48 rounded-b-md border border-border bg-white py-1 text-brand-dark opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                    {g.items.map((it) => (
                      <li key={it.href}>
                        <Link href={it.href} className="block px-4 py-2 hover:bg-brand-light">
                          {it.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-brand-dark py-4">
        <div className="mx-auto max-w-7xl px-4 text-xs font-semibold uppercase tracking-wide text-white/70">
          Gastro Intranet
        </div>
      </footer>
    </>
  );
}
