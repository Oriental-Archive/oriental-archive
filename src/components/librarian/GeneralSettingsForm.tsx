"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function GeneralSettingsForm(props: {
  initialAnnouncementEnabled: boolean;
  initialAnnouncementText: string;
  initialContactEmail: string;
}) {
  const router = useRouter();
  const [announcementEnabled, setAnnouncementEnabled] = useState(props.initialAnnouncementEnabled);
  const [announcementText, setAnnouncementText] = useState(props.initialAnnouncementText);
  const [contactEmail, setContactEmail] = useState(props.initialContactEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ general: { announcementEnabled, announcementText, contactEmail } }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.issues?.[0]?.message ?? data.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      // A network drop or a non-JSON error response (res.json() throwing)
      // previously left this silently doing nothing — busy reset by the
      // finally below, but no sign anything went wrong.
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={announcementEnabled}
          onChange={(e) => setAnnouncementEnabled(e.target.checked)}
          className="accent-navy"
        />
        Show a site-wide announcement banner
      </label>
      <Field label="Announcement text" hint="The banner only shows once this and the checkbox above are both set.">
        <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Contact email (shown in the footer)" hint="Optional.">
        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} size="sm" className="self-start">
          {busy ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-xs text-muted">Saved.</span>}
      </div>
    </form>
  );
}
