export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Simple GET search box that updates ?q= (server-side filtering). */
export function SearchBox({ placeholder = "Cari…", defaultValue = "" }: { placeholder?: string; defaultValue?: string }) {
  return (
    <form className="mb-4">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-9 w-full max-w-sm rounded-md border border-border bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      />
    </form>
  );
}
