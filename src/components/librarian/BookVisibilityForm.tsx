"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";

export function BookVisibilityForm(props: {
  bookId: string;
  initialVisibility: "DRAFT" | "PUBLIC" | "PRIVATE";
  initialAllowOnlineReading: boolean;
  initialAllowDownload: boolean;
  initialPrivateUserIds: string[];
  accounts: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(props.initialVisibility);
  const [allowOnlineReading, setAllowOnlineReading] = useState(props.initialAllowOnlineReading);
  const [allowDownload, setAllowDownload] = useState(props.initialAllowDownload);
  const [privateUserIds, setPrivateUserIds] = useState(props.initialPrivateUserIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/books/${props.bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          allowOnlineReading,
          allowDownload,
          ...(visibility === "PRIVATE" ? { privateUserIds } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Visibility">
        <Select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
          <option value="DRAFT">Draft (librarians only)</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private (specific accounts only)</option>
        </Select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={allowOnlineReading}
          onChange={(e) => setAllowOnlineReading(e.target.checked)}
          className="accent-navy"
        />
        Allow online reading
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={allowDownload}
          onChange={(e) => setAllowDownload(e.target.checked)}
          className="accent-navy"
        />
        Allow download
      </label>

      {visibility === "PRIVATE" && (
        <Field label="Accounts with access">
          <Select
            multiple
            value={privateUserIds}
            onChange={(e) => setPrivateUserIds(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="h-32"
          >
            {props.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.email})
              </option>
            ))}
          </Select>
        </Field>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={busy} size="sm" className="self-start">
          {busy ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-muted">Saved.</span>}
      </div>
    </div>
  );
}
