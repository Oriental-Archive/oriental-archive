"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Field, Input } from "@/components/ui/Field";

export type FooterChurchData = {
  id: string;
  name: string;
  websiteUrl: string | null;
  displayOrder: number;
  enabled: boolean;
};

type FieldKey = "name" | "websiteUrl";

export function FooterChurchesManager(props: { churches: FooterChurchData[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    websiteUrl: websiteRef,
  };

  function flagField(key: FieldKey, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    fieldRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "center" });
    fieldRefs[key].current?.focus();
  }

  async function addChurch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (name.trim() === "") {
      return flagField("name", "Name is required — fill in this box before saving.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/footer-churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          websiteUrl: websiteUrl || undefined,
          displayOrder: props.churches.length,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        const issue = data.issues?.[0];
        const key = issue?.path?.[0] as FieldKey | undefined;
        if (key && key in fieldRefs) {
          flagField(key, issue.message);
        } else {
          setError(issue?.message ?? data.error ?? "Failed to add.");
        }
        return;
      }
      setName("");
      setWebsiteUrl("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/admin/footer-churches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/footer-churches/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="text-xs text-muted">
        Disabled by default — enable an entry only once permission for that church&apos;s
        name/logo has actually been obtained (spec §26). No logo upload yet; entries show as a
        name, optionally linked.
      </p>
      {props.churches.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-b border-border">
          {props.churches.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{c.name}</p>
                {c.websiteUrl && <p className="truncate text-xs text-muted">{c.websiteUrl}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    disabled={busy}
                    onChange={(e) => toggleEnabled(c.id, e.target.checked)}
                    className="accent-navy"
                  />
                  Enabled
                </label>
                <ConfirmButton
                  label="Remove"
                  size="sm"
                  disabled={busy}
                  confirmTitle={`Remove "${c.name}" from the footer?`}
                  onConfirm={() => remove(c.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addChurch} className="flex flex-wrap items-end gap-2" noValidate>
        <Field label="Name" required error={fieldErrors.name}>
          <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Website" hint="Optional." error={fieldErrors.websiteUrl}>
          <Input ref={websiteRef} type="url" placeholder="https://…" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" disabled={busy || !name}>
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
