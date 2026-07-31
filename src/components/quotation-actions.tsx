"use client";
import Link from "next/link";
import { Copy, FileText, GitBranch, Pencil, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuotationActions({
  id,
  duplicate,
  revise,
  remove,
  canEdit,
  canCreate,
  canDelete,
}: {
  id: number;
  duplicate: () => Promise<void>;
  revise: () => Promise<void>;
  remove: () => Promise<void>;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/sales/quotations/${id}/pdf`} className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
        <FileText /> PDF
      </Link>
      {canEdit && (
        <>
          <Link
            href={`/sales/quotations/${id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Pencil /> Edit
          </Link>
          <Link
            href={`/sales/quotations/${id}/items`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Items
          </Link>
        </>
      )}
      {canCreate && (
        <>
          <form action={duplicate}>
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Copy /> Duplicate
            </button>
          </form>
          <form action={revise}>
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <GitBranch /> Revise
            </button>
          </form>
        </>
      )}
      {canDelete && (
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm("Hapus quotation ini? Tindakan ini tidak bisa dibatalkan.")) e.preventDefault();
          }}
        >
          <button type="submit" className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}>
            <Trash2 /> Hapus
          </button>
        </form>
      )}
    </div>
  );
}
