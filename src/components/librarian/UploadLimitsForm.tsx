"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const MB = 1024 * 1024;
type FieldKey = "maxDocumentUploadBytes" | "maxImageUploadBytes";

export function UploadLimitsForm(props: {
  initialMaxDocumentUploadBytes: number;
  initialMaxImageUploadBytes: number;
}) {
  const router = useRouter();
  const [maxDocMb, setMaxDocMb] = useState(String(Math.round(props.initialMaxDocumentUploadBytes / MB)));
  const [maxImgMb, setMaxImgMb] = useState(String(Math.round(props.initialMaxImageUploadBytes / MB)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saved, setSaved] = useState(false);

  const maxDocRef = useRef<HTMLInputElement>(null);
  const maxImgRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
    maxDocumentUploadBytes: maxDocRef,
    maxImageUploadBytes: maxImgRef,
  };

  function flagField(key: FieldKey, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    fieldRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "center" });
    fieldRefs[key].current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);

    const doc = Number(maxDocMb);
    const img = Number(maxImgMb);
    if (!Number.isFinite(doc) || doc <= 0) {
      return flagField("maxDocumentUploadBytes", "Enter a document size greater than 0.");
    }
    if (!Number.isFinite(img) || img <= 0) {
      return flagField("maxImageUploadBytes", "Enter an image size greater than 0.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadLimits: {
            maxDocumentUploadBytes: Math.round(doc * MB),
            maxImageUploadBytes: Math.round(img * MB),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        // Nested schema (site-settings/route.ts) — a Zod issue path here is
        // ["uploadLimits", fieldName], so the field name is the *second*
        // segment, not the first as in flat-schema forms elsewhere.
        const issue = data.issues?.[0];
        const key = issue?.path?.[1] as FieldKey | undefined;
        if (key && key in fieldRefs) {
          flagField(key, issue.message);
        } else {
          setError(issue?.message ?? data.error ?? "Failed to save.");
        }
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
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Max document size (MB)" error={fieldErrors.maxDocumentUploadBytes}>
          <Input ref={maxDocRef} type="number" min={1} value={maxDocMb} onChange={(e) => setMaxDocMb(e.target.value)} />
        </Field>
        <Field label="Max cover image size (MB)" error={fieldErrors.maxImageUploadBytes}>
          <Input ref={maxImgRef} type="number" min={1} value={maxImgMb} onChange={(e) => setMaxImgMb(e.target.value)} />
        </Field>
      </div>
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
