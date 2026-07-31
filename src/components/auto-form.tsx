"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, FormField, FormSection, Select, Textarea } from "@/components/ui/field";
import { groupBySection, type FieldDef, type FormState } from "@/lib/form-defs";
import { cn } from "@/lib/utils";

const SPAN: Record<number, string> = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3" };

function Control({
  f,
  value,
  error,
}: {
  f: FieldDef;
  value: unknown;
  error?: string;
}) {
  const id = `f_${f.name}`;
  const v = value == null ? "" : String(value);
  const common = { id, name: f.name, required: f.required, "aria-invalid": Boolean(error) };

  if (f.type === "select") {
    return (
      <Select {...common} defaultValue={v}>
        <option value="">— pilih —</option>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }
  if (f.type === "textarea") return <Textarea {...common} defaultValue={v} placeholder={f.placeholder} />;
  if (f.type === "checkbox")
    return (
      <div className="flex h-9 items-center">
        <Checkbox {...common} value="1" defaultChecked={v === "true" || v === "1"} />
      </div>
    );
  return (
    <Input
      {...common}
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type ?? "text"}
      step={f.type === "number" ? "any" : undefined}
      defaultValue={v}
      placeholder={f.placeholder}
    />
  );
}

export function AutoForm({
  fields,
  values = {},
  action,
  submitLabel = "Simpan",
  cancelHref,
  defaultSection = "Umum",
}: {
  fields: FieldDef[];
  values?: Record<string, unknown>;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel?: string;
  cancelHref?: string;
  defaultSection?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const sections = groupBySection(fields, defaultSection);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md border border-accent/30 bg-accent/5 px-4 py-2 text-sm text-accent">
          {state.error}
        </p>
      )}
      {sections.map(([title, fs]) => (
        <FormSection key={title} title={title}>
          {fs.map((f) => (
            <FormField
              key={f.name}
              label={f.label}
              htmlFor={`f_${f.name}`}
              hint={f.hint}
              error={state.fieldErrors?.[f.name]}
              className={cn(SPAN[f.span ?? 1])}
            >
              <Control f={f} value={values[f.name]} error={state.fieldErrors?.[f.name]} />
            </FormField>
          ))}
        </FormSection>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
        {cancelHref && (
          <Link href={cancelHref} className="text-sm text-muted hover:text-brand-dark">
            Batal
          </Link>
        )}
      </div>
    </form>
  );
}
