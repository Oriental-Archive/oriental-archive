"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";

const STATUSES = ["NEW", "REVIEWING", "APPROVED", "ADDED", "DECLINED"] as const;

export function RequestManageForm(props: {
  requestId: string;
  initialStatus: (typeof STATUSES)[number];
  initialNotes: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initialStatus);
  const [notes, setNotes] = useState(props.initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/admin/book-requests/${props.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, internalNotes: notes || null }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.issues?.[0]?.message ?? data?.error ?? "Failed to save.");
      }
    } catch {
      // A network drop previously left this silently doing nothing — saving
      // reset by the finally below, but no sign anything went wrong.
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Status">
        <Select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Internal notes (never shown to the requester)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving} size="sm" className="self-start">
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-muted">Saved.</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
