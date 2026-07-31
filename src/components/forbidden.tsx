export function Forbidden({ what }: { what?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-lg font-semibold text-accent">Akses ditolak</p>
      <p className="mt-1 text-sm text-muted">
        Anda tidak memiliki izin untuk mengakses {what ?? "halaman ini"}.
      </p>
    </div>
  );
}
