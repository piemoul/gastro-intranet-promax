"use client";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Edit link + confirming delete button for admin tables. */
export function RowActions({
  editHref,
  remove,
  confirmText = "Hapus data ini?",
}: {
  editHref?: string;
  remove?: () => Promise<void>;
  confirmText?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {editHref && (
        <Link href={editHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <Pencil /> Edit
        </Link>
      )}
      {remove && (
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm(confirmText)) e.preventDefault();
          }}
        >
          <Button type="submit" variant="ghost" size="icon" aria-label="Hapus">
            <Trash2 className="text-accent" />
          </Button>
        </form>
      )}
    </div>
  );
}
