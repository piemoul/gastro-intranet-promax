"use client";
import { useState, useTransition } from "react";
import { Check, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import type { PushResult } from "@/server/actions/so";
import { idr } from "@/lib/format";

const TONE: Record<string, string> = {
  neutral: "bg-neutral-200 text-neutral-700",
  info: "bg-amber-100 text-amber-800",
  good: "bg-emerald-100 text-emerald-800",
  bad: "bg-accent/10 text-accent",
};

export function SoBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONE[tone] ?? TONE.neutral}`}>
      {label}
    </span>
  );
}

/** Salesman: submit the SQ for admin approval. */
export function SubmitSoButton({ submit }: { submit: () => Promise<void> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            try {
              await submit();
            } catch (e) {
              setErr((e as Error).message);
            }
          })
        }
      >
        <Send /> {pending ? "Mengajukan…" : "Ajukan jadi SO"}
      </Button>
      {err && <p className="mt-1 text-xs text-accent">{err}</p>}
    </div>
  );
}

/** Admin: approve or reject a submitted order. */
export function DecideSoButtons({
  approve,
  reject,
}: {
  approve: () => Promise<void>;
  reject: (reason: string) => Promise<{ error?: string }>;
}) {
  const [pending, start] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              try {
                await approve();
              } catch (e) {
                setErr((e as Error).message);
              }
            })
          }
        >
          <Check /> Approve
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowReject((v) => !v)}>
          <X /> Tolak
        </Button>
      </div>
      {showReject && (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <Textarea
            placeholder="Alasan penolakan…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setErr(null);
                const r = await reject(reason);
                if (r?.error) setErr(r.error);
                else setShowReject(false);
              })
            }
          >
            Kirim penolakan
          </Button>
        </div>
      )}
      {err && <p className="text-xs text-accent">{err}</p>}
    </div>
  );
}

/** Admin: push an approved order to Accurate (dry run unless writes are enabled). */
export function PushAccurateButton({ push }: { push: () => Promise<PushResult> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PushResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            setResult(null);
            try {
              setResult(await push());
            } catch (e) {
              setErr((e as Error).message);
            }
          })
        }
      >
        <Upload /> {pending ? "Memproses…" : "Kirim ke Accurate"}
      </Button>

      {err && <p className="text-xs text-accent">{err}</p>}

      {result && (
        <div className="rounded-md border border-border bg-card p-3 text-xs">
          {result.dryRun ? (
            <p className="mb-2 font-semibold text-amber-700">
              MODE UJI (dry run) — tidak ada yang dibuat di Accurate. Set ACCURATE_WRITE_ENABLED=1 untuk
              benar-benar mengirim.
            </p>
          ) : (
            <p className="mb-2 font-semibold text-emerald-700">
              Terkirim ke Accurate — SO {result.soNumber ?? "(nomor otomatis)"}
            </p>
          )}
          <p>
            Customer: <span className="font-mono">{result.customerNo}</span>
            {result.customerCreated && (
              <span className="ml-1 text-amber-700">
                ({result.dryRun ? "akan dibuat baru" : "dibuat baru"} di Accurate)
              </span>
            )}
          </p>
          <p className="mt-1">Baris yang dikirim:</p>
          <ul className="mt-1 space-y-0.5">
            {result.lines.map((l, i) => (
              <li key={i} className="font-mono">
                {l.itemNo} × {l.qty} {l.unitName ?? ""} @ {idr(l.unitPrice)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
