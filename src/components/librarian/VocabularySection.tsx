"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

type FieldKey = "value" | "label";

export function VocabularySection(props: {
  type: string;
  title: string;
  terms: { id: string; value: string; label: string; active: boolean }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const valueRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = { value: valueRef, label: labelRef };

  function flagField(key: FieldKey, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    setNotice(null);
    fieldRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "center" });
    fieldRefs[key].current?.focus();
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/controlled-terms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        setError("Couldn't update that — please try again.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setNotice(null);
    if (value.trim() === "") return flagField("value", "Value is required — fill in this box before saving.");
    if (label.trim() === "") return flagField("label", "Label is required — fill in this box before saving.");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/controlled-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: props.type, value, label }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issue = data.issues?.[0];
        const key = issue?.path?.[0] as FieldKey | undefined;
        if (key && key in fieldRefs) {
          flagField(key, issue.message);
        } else {
          setError(issue?.message ?? data.error ?? "Failed to add.");
        }
        return;
      }
      // A reused value relabels the existing entry rather than creating a
      // second one — worth saying out loud, since it's a real change to
      // every book already using that term, not just a no-op re-add.
      setNotice(
        res.status === 200
          ? `Updated the existing "${data.previousLabel}" entry — its label is now "${data.label}".`
          : "Added."
      );
      setValue("");
      setLabel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-serif text-lg text-foreground">{props.title}</h2>
      {props.terms.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border border-t border-b border-border">
          {props.terms.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className={t.active ? "text-foreground" : "text-muted"}>
                {t.label} <span className="text-muted">({t.value})</span>
              </span>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={t.active}
                  disabled={busy}
                  onChange={(e) => toggleActive(t.id, e.target.checked)}
                  className="accent-navy"
                />
                Active
              </label>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addTerm} className="mt-3 flex flex-wrap items-end gap-2" noValidate>
        <Field
          label={'Value (stable key, e.g. "tig")'}
          required
          error={fieldErrors.value}
          hint={!fieldErrors.value ? "Reusing an existing value relabels it instead of adding a new entry." : undefined}
        >
          <Input ref={valueRef} value={value} onChange={(e) => setValue(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Label (display name)" required error={fieldErrors.label}>
          <Input ref={labelRef} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
        </Field>
        <Button type="submit" disabled={busy} size="sm">
          Add
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
        {notice && <span className="text-xs text-muted">{notice}</span>}
      </form>
    </section>
  );
}
